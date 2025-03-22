---
title: Oh, THAT'S how a monad is a monoid!
---

I've been coding in Haskell for about 5 years now and I feel very comfortable with monads, but I still balk at the oft-quoted definition[^1]:

> "a monad is a monoid in the category of endofunctors, what's the problem?"

It was only today, reading [this blog post](https://blog.merovius.de/2018/01/08/monads-are-just-monoids.html), that something clicked for me. Now, there are
[many](https://bartoszmilewski.com/2017/09/06/monads-monoids-and-categories/)
[many](https://stackoverflow.com/questions/3870088/a-monad-is-just-a-monoid-in-the-category-of-endofunctors-whats-the-problem)
[many](https://www.reddit.com/r/math/comments/ap25mr/a_monad_is_a_monoid_in_the_category_of/)
[many](https://michelestieven.medium.com/a-monad-is-just-a-monoid-a02bd2524f66)
[many](https://blog.rockthejvm.com/monads-are-monoids-in-the-category-of-endofunctors/)
[many](https://blog.softwaremill.com/monoid-in-the-category-of-endofunctors-b85bab43587b)
posts and articles on this, so I'm not even going to try to provide a comprehensive, robust explanation. However, I do want to point out some key insights that made things click, in hopes that it helps some other poor soul out there.

The biggest thing that got me was how the monadic interface implements the monoidal interface. Once I got this piece, everything else fit into place. See, my problem was trying to figure out how

```hs
return :: a -> m a
(>>=) :: m a -> (a -> m b) -> m b
```

represented the `mempty` and `mappend` operations, respectively. Sure, I can squint my eyes and kind of see how `return` is akin to the identity function and `>>=` does some combining of monadic actions, but it wasn't very convincing to me. Turns out, _**that's the wrong way to think about it**_! The _actual_ monoidal definition of monads uses _`join`_, not `>>=`!

_(Of course, you can implement each in terms of the other, so `return`/`join` is just as descriptive of a monad as `return`/`>>=`)_

Concretely, this is how I get the `Monoid` interface and the `Monad` interface to look analogous in my head:

```hs
class Monoid a where
  mempty :: () -> a
  mappend :: (a, a) -> a

class Monad m where
  return :: Identity a -> m a
  join :: m (m a) -> m a
```

With some hand-waving, these are equivalent definitions to the standard definitions in Haskell:
* `mempty` now takes in unit as an argument, which is redundant but equivalent
* `mappend` is uncurried
* `return` now takes `Identity a` instead of `a`, which would be annoying in practice to wrap and unwrap, but since `Identity a` is effectively an alias for `a`, they're equivalent at the type level
* And as discussed before, `join` is included in the `Monad` interface instead of `>>=`, but they're equal in power (`join mm = mm >>= id`; `m >>= f = join (fmap f m)`)

After being convinced that these definitions are equivalent to the current definitions, you can now squint and see the resemblence:

```hs
mempty :: ()         -> a
return :: Identity _ -> m _

mappend :: (a, a)   -> a
join    ::  m (m _) -> m _
```

After making this connection, everything else fell into place pretty easily. I'm not going to go any further for now (because there are already plenty of other resources out there), but hopefully this gives someone out there the last push of insight the way it did for me.

[^1]: [A Brief, Incomplete, and Mostly Wrong History of Programming Languages](http://james-iry.blogspot.com/2009/05/brief-incomplete-and-mostly-wrong.html)
