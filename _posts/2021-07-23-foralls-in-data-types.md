---
layout: post
title: "`forall`s in Data Types"
---

This post contains a quick guide to using `forall` in a data type.

# Universally quantified type

```hs
{-# LANGUAGE RankNTypes #-}

data Foo = Foo { traceFoo :: forall a. Show a => a -> IO a }

foo = Foo { traceFoo = \a -> print foo >> return a }

useFoo :: Foo -> IO ()
useFoo (Foo traceFoo) = do
  x <- traceFoo 1
  b <- traceFoo True
  print (x, b)
```

In this example, `Foo` contains a function that is itself parametrized by `a`. When defining a `Foo` value like `foo`, one MUST provide a function that works for any `a`. Then when consuming a `Foo` value in `useFoo`, the caller can call `traceFoo` on any arbitrary `a` (with a `Show` instance).

To go a bit more in-depth, think of `forall` as an additional argument to the function. So `traceFoo` actually has two arguments: the type of `a` (which must have a `Show` instance), and a value of type `a`. With this framework, it makes sense why the caller gets to use the same `traceFoo` function for multiple types; every time the caller calls `traceFoo`, it can provide a different "argument" for the type of `a`.

For more information, see: [https://wiki.haskell.org/Rank-N_types](https://wiki.haskell.org/Rank-N_types)

# Existential type

```hs
{-# LANGUAGE ExistentialQuantification #-}

data Bar a = Bar { getBar :: a }

data SomeBar = forall a. Show a => SomeBar (Bar a)
```

In this example, maybe you want to collect a bunch of `Bar`s in a list. But since lists must contain a single type in Haskell, you can't have one `Bar` containing an `Int` and another containing a `String`. So we define a `SomeBar` type that wraps the `Bar` and hides the type parameter.

```hs
bars :: [SomeBar]
bars = [SomeBar (Bar 1), SomeBar (Bar True), SomeBar (Bar "hello")]

useBar :: SomeBar -> IO ()
useBar (SomeBar bar) = print $ getBar bar
```

When consuming a `SomeBar` value in `useBar`, the ONLY thing the caller knows is that `bar` contains _some_ value of type `a` (which has a `Show` instance). In other words, `bar` _already contains_ some value of some type `a` and `useBar` MUST work with that value, whatever it may be.

Typically, existential types are only useful when attaching a constraint on `a`. Without a constraint, the caller knows that `bar` contains _some_ value of type `a`, but it can't usefully use it in any way (because no function works on **all** types, except `id`). If you know about GADTs, existential types can also be useful when `Bar` is a GADT, where pattern matching on a constructor determines what `a` is.

To go more in-depth again: since the `forall` is **outside** the constructor, if we treat `forall` as an additional argument, the `SomeBar` **constructor** is the thing that has two arguments: the type of `a` and a value of type `Bar a`. So every time the provider calls the `SomeBar` constructor, it can provide a different "argument" for the type of `a`.

For more information, see: [https://wiki.haskell.org/Existential_type](https://wiki.haskell.org/Existential_type)

# Recap

|                         | Universally quantifed type | Existential type       |
|-------------------------|:--------------------------:|:----------------------:|
| Who gets to decide `a`? | Consumer                   | Provider               |
| The provider...         | MUST work with any `a`     | Wraps a specific `a`   |
| The consumer...         | May use it with any `a`    | MUST work with any `a` |
