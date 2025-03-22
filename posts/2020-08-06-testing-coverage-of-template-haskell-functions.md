---
title: "Testing Coverage of Template Haskell functions"
---

In my [`aeson-schemas`](https://github.com/LeapYear/aeson-schemas) library, I implement quasiquoters that will generate Template Haskell to define type-level schemas and operations to extract data out of a JSON object. Then I would write tests that look like this:

```hs
let o :: Object [schema| { foo: Int } |]
    o = either error id $ eitherDecode [aesonQQ| { "foo": 1 } |]

[get| o.foo |] `shouldBe` 1
```

I can run this with `stack test` and it would succeed. But after this succeeds, I wanted to measure coverage with `stack test --coverage`. The problem is that quasiquoters run and are spliced at compile-time, so the code that's actually being tested looks like this:

```hs
let o :: Object ('SchemaObject '[ '("foo", 'SchemaScalar Int) ])
    o = either error id $ eitherDecode ...

getKey (Proxy @"foo") o `shouldBe` 1
```

So we're getting coverage on `getKey`, but not getting any coverage on the `get` or `schema` quasiquoters.

The first problem here is that we need to actually run the quasiquoters at runtime, in addition to splicing them. Quasiquoters run in the `Q` monad, so we would need to figure out a way to run the `Q` monad at run-time.

The second problem is that I would like to avoid duplicating each of my test cases, e.g.

```hs
[ testCase "o.foo spliced" $
    [get| o.foo |] `shouldBe` ...
, testCase "o.foo runtime" $
    quoteExp get "o.foo" `shouldBe` ...
, ...
]
```

In this blog post, I'll be going over how I solved these problems (with the help of a new library I wrote for this purpose), and hopefully it'll help someone else needing to do a similar task.

# Running TH code at runtime

The first problem is to run the `Q` monad at runtime. Luckily, `template-haskell` provides a helpful `runQ` function which gets us 90% of the way there:

```hs
runQ :: Quasi m => Q a -> m a
```

The good news: `IO` has a `Quasi` instance, which means we can use this function to run the `Q` monad in `IO`. The bad news: the `Quasi IO` instance only works for a very limited number of methods, and errors when calling functions like `reify` or `lookupTypeName`. More bad news: there's no way to get the error message out of a failure. It's an [open issue](https://gitlab.haskell.org/ghc/ghc/-/issues/2340) that `recover` doesn't include the error message, and the `MonadFail` instance of `Q` throws away the `fail` message, so naively using `try (runQ ...) :: IO (Either SomeException ...)` will result in the unhelpful message `Left "Q monad failure"`.

In order to solve this, I decided to write my own monad that implements `Quasi`. That way, we can manually mock functions like `reify` AND catch the actual error messages. Word of warning: this is a fairly hacky solution that depends on Template Haskell internals, but unfortunately, it's the best we can do right now.

## Catching error messages

The first thing we'll do is write a monad that will pass everything through to the `Q` monad, except with an error handling system that lets us get the actual error message. First, let's look at how the `Q` monad throws errors ([source](http://hackage.haskell.org/package/template-haskell-2.16.0.0/docs/src/Language.Haskell.TH.Syntax.html#line-194)):

```hs
newtype Q a = Q { unQ :: forall m. Quasi m => m a }

instance Fail.MonadFail Q where
  fail s = report True s >> Q (Fail.fail "Q monad failure")
```

So it uses the `report True` function (`True` indicates that this is an error message being reported, as opposed to a warning message) to report the error message (which ostensibly gets passed to GHC to display a pretty compile-time message) and then calls `fail` in the `Quasi` instance we're defining. This shows us why we only ever get the unhelpful "Q monad failure" message if we used `try`; because `fail` never actually gets the error message!

So it seems like we'll need to do an indirect pass of storing the message in our `qReport` implementation (`report` is basically just a proxy to `qReport`) and then get back the message in our `fail` implementation. Our first pass will look something like this:

```hs
newtype TestQ a = TestQ
  { unTestQ ::
      -- store the message for ExceptT to throw
      StateT (Maybe String)
        -- gets the message from StateT and return 'Either String a'
        ( ExceptT String
            Q
        )
        a
  } deriving
    ( Functor
    , Applicative
    , Monad
    , MonadIO
    )

instance Quasi TestQ where
  qReport _ msg = TestQ $ State.put $ Just msg
  ...

instance MonadFail TestQ where
  fail msg = do
    storedMessage <- TestQ State.get
    TestQ $ lift $ Except.throwE $ fromMaybe msg storedMessage

tryTestQ :: Q a -> Q (Either String a)
tryTestQ =
  Except.runExceptT              -- ExceptT String Q a => Q (Either String a)
  . (`State.evalStateT` Nothing) -- StateT ... a       => ExceptT String Q a
  . unTestQ                      -- TestQ a            => StateT ... a
  . runQ                         -- Q a                => TestQ a
```

Notice that, now when `fail` is called in the `Q` monad, it will:

1. Call `qReport`, which will:
    1. Store the message in the `StateT` state
1. Call `fail`, which will:
    1. Get the stored message from `qReport`
    1. Throw the stored message with `ExceptT`

And now with the `tryTestQ` function, we can successfully catch and test the actual error messages thrown by our Template Haskell function! Catching errors is definitely important for testing coverage, but we still end up with the `Q` monad. Next step is actually running the `Q` monad at runtime.

## Mock Q functions

If the Template Haskell function is pure enough (i.e. not needing to inspect the type environment), we could just use `runQ`:

```hs
tryTestQ_IO :: Q a -> IO (Either String a)
tryTestQ_IO = runQ . tryTestQ
```

but this won't work if you use features like `reify` or `lookupTypeName`. So let's augment `TestQ` to mock out these functions. For this blog post, I'll only mock out `lookupTypeName`, but it should be straightforward to extend for the other functions. First, we need a data type storing the mocks. Then, we'll need to store it in `TestQ` and use in `qLookupName` (the proxy for `lookupTypeName` and `lookupValueName`).

```hs
data QState = QState
  { knownNames :: [(String, Name)]
  }

newtype TestQ a = TestQ
  { unTestQ ::
      ReaderT QState
        ( ...
        )
        a
  } deriving (...)

instance Quasi TestQ where
  qLookupName _ name = do
    QState{knownNames} <- TestQ Reader.ask
    return $ lookup knownNames name

  ...

tryTestQ :: QState -> Q a -> Q (Either String a)
tryTestQ qState =
  Except.runExceptT
  . (`State.evalStateT` Nothing)
  . (`Reader.runReaderT` qState)
  . unTestQ
  . runQ
```

And now, running

```hs
tryTestQ (QState [("Maybe", ''Maybe)]) ...
```

will lookup using the names we've specified. At this point, we can go ahead and use `tryTestQ_IO`, and it'll now work with our mocks! We could even use `unsafePerformIO` to get back pure results:

```hs
tryTestQ_IO :: QState -> Q a -> IO (Either String a)
tryTestQ_IO qState = runQ . tryTestQ qState

tryTestQ_Pure :: QState -> Q a -> Either String a
tryTestQ_Pure qState = unsafePerformIO . tryTestQ_IO qState
```

All in all, this was a ton of fun, but it's a ton of work to do, all to set up what we actually want to do &mdash; write tests! So I've pushed all of this work into the [`th-test-utils`](https://github.com/LeapYear/th-test-utils) package (the implementation here isn't pushed to Hackage yet, but it's on `master`), hopefully to make someone else's life easier.

# Avoid duplicating tests

Ok so now that we're able to run Template Haskell functions at runtime, I would like to avoid duplicating all of my tests (one to test the spliced implementation, one to run at runtime and get coverage). So the general idea is to take the prior implementation:

```hs
[get| o.foo |]
===>
getKey @"foo" o
```

and write a new quasiquoter that will splice into running the quasiquoter itself (quine-style) in addition to the normal splice. We'll use `deepseq` to fully evaluate the quasiquoter before returning the usual value (you'll need to implement `NFData` for all the Template Haskell types, a separate package I'll hopefully split off soon).

```hs
[runGet| o.foo |]
===>
quoteExp get "o.foo" `deepseq` getKey @"foo" o
```

Note: `[get| ... |]` is just syntax sugar for `quoteExp get "..."` when used as an expression. The implementation is fairly straightforward:

```hs
runGet :: QuasiQuoter
runGet = QuasiQuoter
  { quoteExp = \s ->
      [|
        quoteExp get s    -- run quasiquoter at run-time
        `deepseq`
        $(quoteExp get s) -- run quasiquoter at compile-time and
                          -- actually return this value at run-time
      |]
  , ...
  }
```

# Test all the things!

And now, `runGet` is a drop-in replacement for `get` in our tests that will splice the `get` quasiquoter as usual, *as well as* running the quasiquoter at runtime (ignoring the value), finally resulting in automatic coverage on the quasiquotation actually being spliced!

```hs
-- old, without coverage
testCase "Test o.foo" $
  [get| o.foo |] `shouldBe` 1

-- new, with coverage
testCase "Test o.foo" $
  [runGet| o.foo |] `shouldBe` 1
```

If you have a library that uses Template Haskell or QuasiQuoters, I hope the `th-test-utils` library will help you write more/better unit tests. Getting coverage on my library actually helped me uncover bugs, and I hope it can do the same for you!
