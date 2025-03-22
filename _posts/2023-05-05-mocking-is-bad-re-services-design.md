---
layout: post
title: 'Mocking is bad, RE: Services design'
---

The [previous post]({% post_url 2023-05-03-services-design-pattern %}) discussed a design pattern that enables writing tests with stubbed responses to test complex IO functions. You might have read the post and were reminded of the blog post ["Why mocking is a bad idea"](https://cs-syd.eu/posts/2021-10-22-why-mocking-is-a-bad-idea) and wondered why I'd be recommending such tests. Yes, I also agree that mocking is a bad idea; the difference is that the previous blog post discussed tests that _stubbed_ IO actions, not _mocked_.

This blog post discusses the concept of mocking in the context of the previous post on the Services design, but it's also relevant in the general context of unit tests vs integration tests.

## Mocking vs stubbing

The problem with mocking arises when trying to write code that simulates a real world system with an in-memory approximation. But the Services design describes writing tests with Service records that have hardcoded responses, e.g. `pure True`.

```haskell
-- mocking
ref <- newIORef [] :: IO (IORef [(String, String)])
someFunc
  MyService
    { readFile = \path -> lookup path <$> readIORef ref
    , writeFile = \path s -> modifyIORef ref ((path, s) :)
    }

-- stubbing
someFunc
  MyService
    { readFile = \_ -> pure "hello world"
    , writeFile = \_ _ -> pure ()
    }
```

The stubbed test doesn't rely on the test implementation to be correct; in fact, the stubbed test is so trivial that it's almost a red flag. The mental warning bells are a _good thing_: it reminds you to write integration tests, because the unit tests are _very obviously_ not asserting anything about how `readFile`/`writeFile` interact with each other.

## Mocking adds complexity

The blog post says:

> Making code mockable makes it more complex and thus more likely to be wrong.

This argument would make sense if we're talking about code with dependency injection vs code without. But I would say most projects already use mtl or some other effects solution, and the Services design is no more complex. If you can write a clear, maintainable codebase without any of these design patterns, do it. But in most cases, the code will already be complex; adding mockability with the Services design will not change the situation.

## Mocking hides bugs

The blog post also says:

> Mocking hides real bugs. It makes tests pass that would have failed if not for the fake objects.

The article seems to assume the developer is not writing _any_ integration tests. The `refreshFile` example provided would've been caught with just one basic integration test. Even with the Services design, you most definitely should be writing integration tests to check the function actually works in a live system.

**No one should be writing all unit tests and being confident their code works.**

The blog post discusses mocking as not accounting for "unknown unknowns", but that's true of all tests, even integration tests. Sure, unit tests that don't actually touch a live system account for fewer variables than integration tests, but that doesn't mean we should not write _any_ unit tests. Perfect is not the enemy of good: just because unit testing IO interactions doesn't give 100% confidence, doesn't mean they're pointless.

## Closing thoughts

All tests have bugs, all tests have variables not being accounted for (are you testing what happens if the machine runs out of memory in the middle of your function?). Every test has trade-offs: unit tests are fast but not representative of real-world usage, integration tests are more representative but not fast. That's why a good test suite has both: you unit test as much as you can, with integration tests covering more of the boundaries (plus end-to-end testing, etc.). Insert obligatory reference to the [test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) here.

How to test well is always an ongoing conversation. There will never be a perfect test suite that works for every team, every company, every usecase. All the Services design provides is the possibility to easily write tests _you might want to write_ that's not easy to write otherwise. If you don't want or need to write these tests, use the Services design without writing these tests (or don't use it at all; I'm definitely not claiming that the Services design is for everyone).
