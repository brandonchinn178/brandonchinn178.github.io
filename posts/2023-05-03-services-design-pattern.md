---
title: The "Services" design pattern
---

In large systems, [dependency injection](https://en.wikipedia.org/wiki/Dependency_injection) is a powerful design pattern that allows subsystems to be modular and iterate independently of other subsystems. Concretely, it enables building subsystems in parallel and testing them independently.

In the Haskell ecosystem, we have quite a few ways to solve this problem: MTL, effect patterns, etc. This blog post will cover an alternative solution, named the "Services" design pattern.

## Overview

At its core, the Services design pattern aims for simplicity and clarity, at the expense of succinctness and preciseness. Its primary mechanism for dependency injection is basic record types, instead of type classes and type-level shenanigans. This approach makes this design pattern particularly useful for teams containing contributors with rudimentary Haskell experience. The Services design could be roughly described as a cross between MTL-style effects and the Handle pattern (see below for more details).

The way it works is each subsystem defines their own types, as well as a Service record containing all side-effectful operations (in `IO`!) that the subsystem requires. There should be minimal, if any, sharing of types between subsystems, to enable each subsystem to be built in parallel and iterate independently of other subsystems. Then the entrypoint would initialize each subsystems' Service and pass it as a normal argument when invoking a function from a subsystem.

### Give me some code!

Let's say you have a system for managing users and their blog posts. The system is a REST API, with one subsystem for managing users (e.g. authentication) and one subsystem for managing blog posts.

Using the Services design, the user subsystem might look like:

```haskell
module MyProject.Users.Models where

newtype UserId = UserId {unUserId :: Int}

-- Parametrize userId so that it's _not_ set when creating a user at first,
-- but it will be guaranteed to be set when loading a user any other time
data UserBase userId = User
  { userId :: userId
  , userName :: Text
  , userAge :: Int
  }

type User = UserBase UserId

-- Instead of `()`, I also found it useful to create a new `NotSet`
-- newtype around `()` with a nice Show instance and such
type UserNew = UserBase ()
```

```haskell
module MyProject.Users.Errors where

import MyProject.Users.Models

-- All errors that we throw in the subsystem (not necessarily including
-- errors thrown by UserService implementations)
data UserError
  = InvalidAge Int
  | UserNotFound UserId
```

```haskell
module MyProject.Users.Service where

import MyProject.Users.Errors
import MyProject.Users.Models

-- All side-effectful functions, e.g. database functions
data UserService = UserService
  { saveNewUser :: UserNew -> IO UserId
  , getUser :: UserId -> IO (Maybe User)
  }

-- Also include functions derived from service functions
loadUser :: UserService -> UserId -> IO User
loadUser UserService{..} userId =
  getUser userId >>= maybe (throwIO $ UserNotFound userId) pure
```

```haskell
module MyProject.Users (
    module MyProject.Users,
    -- re-export submodules
    module X,
) where

import MyProject.Users.Errors as X
import MyProject.Users.Models as X
import MyProject.Users.Service as X

createUser :: UserService -> UserNew -> IO User
createUser UserService{..} newUser = do
  unless (userAge >= 0) $ throwIO (InvalidAge userAge)
  userId <- saveNewUser newUser
  pure newUser{userId = userId}
```

Some comments on this approach:
* Everything being in `IO` makes everything much simpler, especially for beginners. You do lose specificity, as you can "do anything" in `IO`, but in practice, it's more immediately understandable than having a whole list of `MonadThrow` &co.
    * If you have code that needs to be in a particular monadic context (e.g. code that needs to run in a single database transaction), go ahead and use whatever `SqlTransaction` monad you have. But this design pattern encourages you to double check if you actually need that, defaulting to the simpler, plain `IO` if not.
* This abstracts away the database library, with numerous benefits:
    1. The subsystem can build in parallel with building the database models. In our case, we were using `persistent` Template Haskell definitions with over 20 models, which was really slow to compile, and cutting this out of the dependencies of our subsystems greatly improved our build experience.
    1. This puts all the ORM-specific logic into one place (when defining the service at the top-level), which allows switching database libraries super easy, if requirements change.
    1. It's great for unit tests, which can just stub out the operation instead of figuring out a way to intercept query execution in the database library
* In addition to abstracting away the database library, it also abstracts away the actual schema of the database. Your business logic and your tests shouldn't need to care if your `user` model is broken up into multiple SQL tables or what indexes you've set up.

The blog post subsystem would look similarly, but importantly would _not_ import `User` from `MyProject.Users`. Instead, it would define its own type:

```haskell
module MyProject.BlogPosts.Models where

newtype UserId = UserId {unUserId :: Int}

data BlogPostBase postId = BlogPost
  { postId :: postId
  , postTitle :: Text
  , postAuthorId :: UserId
  }
```

The advantage of this approach is that, if these two subsystems are in separate packages (e.g. `my-project-users` and `my-project-blog-posts`), the two packages can build in parallel. And more often than not, if the subsystem doesn't own the relevant model, it doesn't need any more information than some identifier. The verbosity cost of the duplication isn't too bad; to create a `BlogPost`, it would look something like:

```haskell
import MyProject.BlogPosts qualified as BlogPosts
import MyProject.Users qualified as Users

BlogPost
  { postAuthorId = BlogPosts.UserId . Users.unUserId $ userId
  }
```

Some helper functions can make this even better, if desired, e.g. using `Coercible`.

### What about testing?

To unit test a function in a subsystem, simply define a Service record that stubs out the relevant side-effectful functions. For example, say you had a function that makes three database queries and does different things for each combination of responses.

```haskell
data MyService = MyService
  { complicatedDBQuery1 :: IO Bool
  , complicatedDBQuery2 :: IO (Maybe Int)
  , complicatedDBQuery3 :: IO String
  }

complicatedOperation MyService{..} = do
  a <- complicatedDBQuery1
  b <- complicatedDBQuery2
  c <- complicatedDBQuery3
  case (a, b, c) of
    (True, Just _, _) -> ...
    (_, Nothing, msg) -> ...
    ...
```

**You should still write a couple integration tests** to make sure the database queries generally work, but you probably also want a test for every combination of responses. If the integration tests already verify the database queries generally work, there's no point trying to figure out how to get the database in a state to test each combination of responses. It'll be difficult, prone to errors, and slow to run.

Instead, with the Service design, just write unit tests that stub out each response you want to test:

```haskell
testCase "does thing when ..." $ do
  result <-
    complicatedOperation
      MyService
        { complicatedDBQuery1 = pure True
        , complicatedDBQuery2 = pure (Just 1)
        , complicatedDBQuery3 = pure ""
        }
  result @?= ...
```

This makes it extremely clear what case each test is testing, avoids a bunch of code to set up the database in just the right way, and brings test runtime to less than a second. In our case, we had a couple integration tests, but because it was so hard to set up all the system dependencies, we didn't have tests covering all the possible branches the business logic could take. And before switching to the Services design pattern, it was impossible to unit test the code.

## Comparison to other approaches

One of the biggest aspects of the Services design pattern is defining new models instead of sharing models between subsystems or reusing the same models as the database library models. This could also be done with any of the below frameworks for the same advantages (parallel builds, avoid [sharing data types]({{ "posts/2023-04-15-sharing-data-types.md" | inputPathToUrl }}), etc.). The [`registry`](https://github.com/etorreborre/registry) library could also be used to manage the services (thanks to [@etorreborre](https://github.com/etorreborre) for the pointer!).

Additionally, the Services design pattern only discusses designing _subsystems_. When working in the top-level entrypoint, there's still the question of how to pass along the services. At this point, you could utilize MTL or any of the other design patterns to manage the services in the entrypoint, e.g.
* Instantiate the services fresh every time you call a subsystem
* Create `HasUserService` typeclasses with the RIO library
* etc.

So the following comparisons will only focus on managing side-effectful operations in subsystems.

* **MTL**
    ```haskell
    createUser :: (MonadSqlQuery m, MonadThrow m) => UserNew -> m User

    -- or still defining a service to abstract the actual operations
    createUser :: (MonadUserService m) => UserNew -> m User
    ```
    * MTL-style effects are nice in that you can be extremely explicit about what side-effects the function enables.
    * Of course, if you ever add `MonadIO` to the list, it kinda blows a hole through the explicit restriction of effects
    * The downside is that it's difficult to unit test these functions (even with an abstract Service type class), as there isn't an easy way to provide a new instance on a per-test basis. There are [hacks](https://prophetlabs.de/posts/unsafeCoerceDict.html) available to "promote" a record type into a constraint, but I'm not sure how reliable those techniques are.
    * One interesting detail is that the Services design is like MTL, except instead of specifying constraints, you pass in a record. This is what GHC does at runtime anyway, so actually, the Services design pattern is equivalent to the MTL pattern, just with manually passing around the Dict instead of it automatically propagating.

* **RIO / ReaderT design pattern**
    * [RIO](https://www.fpcomplete.com/haskell/library/rio/) is one implementation of the [ReaderT Design Pattern](https://www.fpcomplete.com/blog/2017/06/readert-design-pattern/). It's similar to MTL, except instead of restricting effects on a polymorphic monad, you have one hardcoded monad with a polymorphic read-only context.
    * In a sense, the Services design pattern could be thought of as the RIO pattern, except with the service being passed in as an argument instead of being in the environment. So the tradeoff lies in boilerplate in type classes + instances vs. boilerplate in passing a record around.
    * The Services design pattern agrees with RIO with regards to errors. MTL encourages functions to annotate themselves with `MonadThrow` or `MonadError e` to be explicit about error throwing/handling. But we've found that it's not terribly useful in practice, is misleading, and simplies a lot of code using just plain `IO`.
    * But RIO doesn't help with functions running in a `SqlTransaction` monad. Say you had two functions with business logic that you want to run sequentially in a single database transaction. There isn't a way to use RIO here, since it runs in a concrete `RIO` monad.

* **Handle pattern**
    * This approach shares a lot of similarities with the [Handle pattern](https://jaspervdj.be/posts/2018-03-08-handle-pattern.html), specifically in that both design patterns involve passing a record into every function.
    * The downside of the Handle pattern is that it doesn't provide a way to easily unit test the business logic using the handle.

* **Effects**
    * Effect systems (like `polysemy` or `eff`) are a newer method of managing effects. Similar to RIO, it uses one hardcoded monad with a polymorphic context containing the set of effects allowed.
    * Effect systems seem to be the closest competition to the Services design for writing unit tests with mocked effects. You could use `reinterpret` to stub the operations the unit test cares about and pass through all other operations.
    * ~~Like RIO, effect systems also don't help when defining functions with business logic running in a `SqlTransaction` monad.~~
    * The main downside with effect systems is they haven't been used as much in real world systems. ~~One major question is how good their performance is (possibly getting improved with GHC 9.6's support for delimited continuations).~~
    * _Thanks to [u/arybczak](https://www.reddit.com/r/haskell/comments/136e6vt/comment/jiq8ovb/) for clearing up some of these points_

## Final thoughts

Overall, I found the Services design pattern to be useful and very straightforward. It's not as clever as MTL, and I do sometimes miss making a function as general as it can be (e.g. "this works for _any_ monad with this interface"). But the ability to stub out _anything_ in unit tests more than makes up for that; I'd much rather have really solid code coverage than having a really precise type signature.

If you end up not choosing to embrace the Services design fully, maybe there's something here that inspires a blend of design patterns that works for your particular system. My hope is that people can take parts of different design patterns that works for them, and the Services design is just one collection of ideas that can help someone else out there.

## Addenda

* Thanks to [u/sisyphushappy42](https://www.reddit.com/user/sisyphushappy42/) for pointing out that the [Simple Haskell Handbook](https://leanpub.com/simple-haskell-book) uses this pattern!
* See the [next blog post]({{ "posts/2023-05-05-mocking-is-bad-re-services-design.md" | inputPathToUrl }}) for why stubbing in Services design tests is compatible with the belief that mocking is bad
