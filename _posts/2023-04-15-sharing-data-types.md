---
layout: post
title: Sharing Data Types is Tight Coupling
---

Most people know about the DRY concept; some people are also familiar with the [dangers of DRY](https://www.baseclass.io/newsletter/dry-principle). Matt Rickard's blog post ["DRY Considered Harmful"](https://matt-rickard.com/dry-considered-harmful) contains this particularly pithy quote:

> A little duplication is often better than a little dependency.

As my former company's codebase grew in the early days, we opted to reuse code instead of duplicating types, which was partially encouraged by our use of Haskell, as Haskell provides powerful tools for code reuse (higher kinds of types, type classes, etc.). But eventually, we found that reusing code as much as we did caused subsystems to be tightly coupled, preventing them from evolving independently. Specifically, this friction occurred because the subsystems reused code for different concepts. This meant that the two subsystems couldn't independently iterate within their own domains.

This blog post is broken up into two parts. First, three examples of friction points caused by this tight coupling, and second, a success story from a project to improve error messages where we learned from our previous mistakes and avoided such issues.

## How DRY left us high and dry

### Issue #1: Algorithm queries tightly coupled with RPC protocol

Our system involved a server executing statistical algorithms and a client sending parameters for those algorithms over the wire. The naive approach to this quasi-RPC system was to use the same Haskell data type the algorithm takes as input to serialize/deserialize over the wire, which is what we did.

This created issue #1: we couldn't modify the data types representing an analytical query without changing the public API exposed in our RPC protocol. This was sufficient for us at first, since the client and server were always versioned together. But when we decided we wanted to try to be backward compatible, this hurt us.

First, we were forced to create our own JSON serialization framework. The de-facto standard Haskell JSON library, `aeson`, serializes types differently depending on how the type is defined, which may break backward compatibility. For example, if we had a type:

```haskell
data AlgorithmType = Loose | Strict
```

`aeson` would serialize these as plain `"Loose"` and `"Strict"`. But if we then added a new constructor like:

```haskell
data AlgorithmType = Loose | Strict | Custom String
```

`aeson` would start expecting `{"tag": "Loose"}` and `{"tag": "Strict"}` instead, even though we didn't change those constructors.

Second, we had to commit to never rename or remove things. This resulted in cluttering the business logic with the following:

1. Similarly named constructors like `GroupbyAgg` and `GroupbyAggregation` to both exist in the same namespace
1. Branches to handle deprecated code paths that will never go away, and
1. Constructors or fields to keep outdated names, even as our algorithms team came up with more precise names for concepts

If we had, instead, had two different types from the beginning (one for the protocol and one for the algorithm's code), we could have changed the types over time to whatever made sense for our algorithms team while keeping a backward-compatible interface that provided a mapping from external API to internal.

<div class="callout">
🗣 Note that, while the first `aeson` serialization issue might have been solved with using a "proper" RPC framework like gRPC from the beginning, the second never-remove-anything issue would still be a problem, since the primary issue here isn't the protocol implementation, but rather the lack of an intermediate data representation to convert between the backwards-compatible interface and the normalized up-to-date interface.
</div>

### Issue #2: Storing domain types into the database

In addition to reusing the algorithms query types as the source of truth for the protocol with clients, we were also reusing them as the source of truth for serializing/deserializing data into the database. And similar to the first issue, we ran into trouble when changing the type definitions, since we would be deserializing data with a different format than the format they were serialized with.

For example, one requirement of our product was to save query results keyed on the query that was run. So if a customer was running an old version of the server, they might be running queries of the form:

```haskell
data CountAnalysis = CountAnalysis
  { datasource :: String
  , optimized  :: Bool
  }
```

which would be stored in the database as `{"datasource": "data.csv", "optimized": true}`, along with the result of the query. And running the same COUNT query again would look for `{"datasource": "data.csv", "optimized": true}` and get a cache hit.

But then if the customer upgraded the system to a version changing a COUNT query to:

```haskell
data CountAnalysis = CountAnalysis
  { datasource       :: String
  , optimizationMode :: OptimizationMode
  }

data OptimizationMode
  = NoOptimization -- the old 'false'
  | UseStandardOptimization -- the old 'true'
  | UseExperimentalOptimization
```

then the client might run the "same" query again, but `{"datasource": "data.csv", "optimizationMode": "UseStandardOptimization"}` would no longer match anything in the database.

So if we ever made a change to any of our queries, we also needed to write a database migration that will look at the JSON blob in the database and convert it to the new version (e.g. `"optimization": true` ⇒ `"optimizationMode": "UseStandardOptimization"`), so that a query in the new version of the server could still get a cache hit from an equivalent query from the old version.

In this particular use-case, we were really only using the query as a cache key, so conceptually we could do some normalization + hashing of the query instead of storing blobs that require migration. Or we could create an intermediate data type that can deserialize any old representation that might be in the database and convert it into the data type used by the algorithm. But because we were reusing the same type used by the algorithm (and by the protocol, per issue #1!), we were stuck with this tight coupling.

### Issue #3: Bottlenecks in the build

Lastly, reusing types meant having a package at the very top of the dependency tree defining all of the types to be reused in the rest of the system. For example, even if a package only used the `User` type, it would be blocked on building all the types it doesn't even use. We did some work to improve this bottleneck, but this was still one of the biggest issues in our build.

One way we were trying to solve this was by breaking out domain-level packages that internally defined all the types they needed to know about (see [other blog post]({% post_url 2023-04-22-services-design %})). For example, package A might know about users, but it might really only need a reference to a user's ID, so instead of waiting for `User` and everything `User` depends on to compile, package A can just define a quick

```haskell
data User = User { userId :: Int64 }
```

type. And now, package A can build in parallel with everything else, since it's entirely self-contained.

It might be daunting to think about having to manually convert the canonical `User` type to this stripped-down `User` type every time you call package A functions, but we found this to be fairly uncommon in practice. Besides, a bit of verbosity in a couple places is much better than spending precious minutes of build time (going back to Rickard's quote).

## Beyond DRY: a success story

One consequence of our system dealing with analyzing sensitive data is that we had to be particularly careful about errors we expose to the user. For example, a seemingly innocuous `divide by zero` error could leak sensitive information if the zero came from the raw data. Additionally, when customers installed the system on-prem, internal policies might have forbidden sensitive information from being stored in the database. So when we stored errors into the database, we also needed to ensure that error messages with the potential to contain sensitive information were appropriately obfuscated.

When we started working on this requirement, we first created a new `Error` data type, and wrote conversions from all of our existing exceptions into `Error`. This allowed us to distinguish between exceptions we threw (which we could audit + know do not contain sensitive information) and exceptions our dependencies threw (which might've contained sensitive information in the messages). Next, we needed to be able to store this error into the database.

The naive approach would be to just slap on a `ToJSON`/`FromJSON` instance for `Error` and store it in the database as JSON. But with our negative experience with overly reusing types, we took a different approach: we copied the definition of `Error` into a separate `ErrorDB` type, whose sole purpose was to be serialized to + deserialized from the database, as opposed to `Error`, whose sole purpose was to be propagated in the runtime system as an exception. In other words, the goal here was to avoid tightly coupling the notion of "exceptions" from the notion of "database serialization" by not sharing the same data type for both.

Concretely, this goal resulted in the following improvements:

1. `ErrorDB` could implement `PersistField` (the type class defining how to serialize it into the database) without it being an orphan instance.
1. `Error` and `ErrorDB` could have different JSON representations if we wanted. `Error`'s JSON representation would've been optimized for being sent to a user (for example), and `ErrorDB`'s JSON representation would've been optimized for being stored in the database. In our case, `Error` didn't implement any JSON conversion, so there was no worry about accidentally converting `Error` to JSON with the database JSON representation.
1. Most importantly, having them separate allows us to enforce a transformation `toErrorDB :: IsSensitive -> Error -> ErrorDB` that forced the caller to specify whether the error should've been obfuscated whenever storing an `Error` in the database. And as long as we never exported the constructor for `ErrorDB`, this was the only way to create an `ErrorDB` to store in the database. So in this case, avoiding DRY actually led us to an implementation that prevents us from forgetting to do key business logic!

So, all in all, while copy-and-pasting `Error` into `ErrorDB` initially went against deeply ingrained programming habits, it ultimately gave us flexibility and guarantees we wouldn't be able to have otherwise.

## Final thoughts

You might have read the title of this blog post and thought, "Well of course sharing data types is tight coupling; that's the whole point! If I change a thing here, I want to make sure I handle it in those other places." That was our initial thought too. At first, it did make sense to ensure a single source of truth throughout our codebase. But as our codebase grew, we never re-examined this assumption; we just kept reusing types without thinking, because DRY was second-nature to us.

To be clear, this blog post isn't advocating for the complete elimination of DRY. Our primary takeaway was to think twice when reusing types. Maybe it's worth it to copy-and-paste a data type if it means you can avoid depending on a whole other package. It might even be the case that, even though you're not reusing the data type, changing the original data type might still force you to handle the change in the duplicated area. In summary, DRY is just one tool in the toolbox; using it and not using it are both valid techniques that should be considered instead of dogmatically obeyed.

My coworkers and I had greatly benefited from bringing this discussion to the forefront of our discussions, and hopefully this can benefit others out there as well.
