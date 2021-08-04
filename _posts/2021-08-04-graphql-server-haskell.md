---
layout: post
title: My ideal GraphQL framework for Haskell
---

I'm implementing a GraphQL backend for my personal project in Typescript because that's where all the best GraphQL libraries are. Currently, I'm using [`apollo-server`](https://www.apollographql.com/docs/apollo-server/) built on top of the [`graphql-js`](https://graphql.org/graphql-js/) library, which I've been able to get working fine. But I often find myself wishing I could implement it in Haskell.

It seems as of right now, there are three primary GraphQL frameworks for Haskell:

* [`graphql`](https://hackage.haskell.org/package/graphql) (currently 1.0.0.0)
* [`graphql-api`](https://hackage.haskell.org/package/graphql-api) (currently 0.4.0)
* [`morpheus-graphql`](https://hackage.haskell.org/package/morpheus-graphql) (currently 0.17.0)

There are parts of each that I like, but none of them have all of the features I'd like in a GraphQL server framework. Below, I'll first go over what I'd like in a GraphQL server framework, and then what that ideal GraphQL framework might look like. If you're just itching to see code, you can skip the first section.

* TOC
{:toc}

# Requirements for my ideal GraphQL framework

## Schema should be defined using the GraphQL DSL

One of the biggest benefits of GraphQL is having a language-agnostic DSL to communicate the schema with the client. When I'm writing a GraphQL API, one of the most important things I focus on is designing this schema in exactly the way I want the client to see it.

If the schema is just automatically derived from the code, I would either lose this control over the schema or find myself doing weird things in the code to make the schema correct. Plus, I usually find this method annoying, since I already know the GraphQL DSL, but I'd have to always look up the equivalent syntax for the library (the same reason I'm not a fan of ORMs, but I digress).

**Comparison with existing libraries:** `morpheus-graphql` does support this, but not `graphql` or `graphql-api`.

## Code should be generated from the GraphQL DSL

Continuing from the previous section, if the schema is defined using the GraphQL DSL, it would need to be loaded into Haskell-land somehow. One option is Template Haskell, but that can cause [recompilation issues](https://www.parsonsmatt.org/2021/07/12/template_haskell_performance_tips.html#recompilation-avoidance) and general slower compile times.

I'm rather partial to plain ol' generate-Haskell-code-and-write-to-a-file; it has the benefit of showing the developer exactly what's being generated, and can output docs in comments to help the developer understand how to use the generated code. One could even write a plugin on top of [`graphql-code-generator`](https://graphql-code-generator.com) to reuse their code generation logic; I do this in my [`graphql-client`](https://hackage.haskell.org/package/graphql-client) library, which I am rather happy with.

**Comparison with existing libraries:** `morpheus-graphql` only supports code generation via Template Haskell.

## Resolvers should be clearly associated with field

It should be fairly easy to identify the corresponding GraphQL field for a resolver function. It should be difficult to connect the resolver to the wrong field.

**Comparison with existing libraries:**
* `morpheus-graphql` does this really well, by representing a GraphQL field with a record field, and directly setting it to the resolver function
* `graphql` does not do this well. It associates field to resolver in a `HashMap`. Since resolver functions all have the same type (returning a `Value`), you won't get any compile errors when setting a resolver function to the wrong field.
* `graphql-api` does not do this well. It defines the fields at the type-level, then expects the resolvers to be in the same order (just like Servant). So the field name and the resolver function are far apart from each other.

## Resolvers should be well-typed

A resolver returning the wrong type from the type declared in the schema should be a compile-time error.

**Comparison with existing libraries:**
* `morpheus-graphql` does this well, using record fields with the expected types
* `graphql-api` does this well, checking the resolver type against the type-level API
* `graphql` does not do this well, storing the expected type of the field separately and having the resolver function just return a `Value`, so the type of the field could mismatch the actual returned type

## Resolvers should be defined in separate files

I really like this feature in `apollo-server`, where you can define resolvers for a type across multiple files, and `apollo-server` will stitch them all together. This allows for clean organization of the resolvers by domain; for example, you could define `Query.users` in the user management part of the codebase, and define `Query.posts` in the blogs part of the codebase.

**Comparison with existing libraries:** None of the above libraries support this completely. You can, of course, define the resolver functions wherever you'd like and import them in, but generally, to define a type (e.g. `Query`), you must specify all the fields.

## A GraphQL type should have a canonical data type

In practice, a GraphQL type is represented at runtime by a concrete value with populated fields, with additional virtual fields resolved when needed.

For example, you might have the following `User` GraphQL type:

```graphql
type User {
  id: ID!
  firstName: String!
  lastName: String!
  name: String!
  alive: Boolean!
  posts: [Post!]!
}
```

which might be represented by the following data type:

```hs
data User = User
  { id :: Int
  , firstName :: Text
  , lastName :: Text
  , alive :: Bool
  }
```

Notice that we don't store all the `Post`s a `User` has (we only want to fetch that from the database if the client asks for it), and `User.name` is derivable from `firstName` and `lastName`.

In this case, we'd want to say "all GraphQL fields returning `User` must return this `User` Haskell type" and then additionally be able to specify the `name` and `posts` field resolvers separately. `name` would combine `firstName` and `lastName` and `posts` would use `id` to query the database.

**Comparison with existing libraries:**
* The library I'm currently using, `apollo-server`, doesn't do this well. There's nothing stopping you from returning different objects from different endpoints, and forgetting that you'd need to implement a resolver in case the object is missing a field. [One method](https://medium.com/paypal-tech/graphql-resolvers-best-practices-cd36fdbcef55) is to make everything a virtual field and only track a unique identifier for a given GraphQL type.
* `graphql` doesn't use your custom application types at all; everything has to be serialized to a `Value`
* `morpheus-graphql` and `graphql-api` don't have any notion of intermediate data types; they both just return a set of resolver functions, which can use any values in-scope, but nothing really enforces that

## Nested resolvers should be able to easily access parent object

Kind of related to the "canonical data type" requirement. When resolving a nested query like:

```graphql
query {
  user(id: 1) {
    name
  }
}
```

The `user` field resolver should load the `User` with the given ID, then the `name` field resolver should know the `User` it's being resolved for (to get the name from). Roughly speaking, defining the `name` field resolver should have some type like `User -> m Text`.

**Comparison with existing libraries:**
* `graphql` does this by storing the chain of parent values in the `ReaderT` environment of the field resolver. Note that the parent values here are `Value`s, so you'll get the serialized version of your custom type as the parent value, not your actual application type
* `morpheus-graphql` supports this in an okay manner; you would load the `User` in the `user` resolver and then returning resolvers referencing the in-scope `User` (i.e. stores the `User` in a "closure")
* `graphql-api` supports this in a similar manner to `morpheus-graphql`; you can load the initial object in the `Handler` and then return resolver functions using the loaded `User`

## Support running in an arbitrary monad

It's common for GraphQL servers to have a shared context, e.g. the currently logged-in user. Resolvers should be runnable in a user-defined monad with an environment to do app-specific logic (e.g. database queries).

**Comparison with existing libraries:**
* All of the above libraries support this

## Conclusion

After going through this list, it seems like `morpheus-graphql` would do an okay job, but it would require redesigning my project from being organized by domain to being organized by tech layer (e.g. database layer > business logic layer > graphql layer). I rather like having my project organized by domain, so that the full end-to-end workflow for a particular workflow (e.g. get a user) is colocated.

# My Dream Framework

Ideally, I would like to organize my project with something like:

```
my-project/
├── package.yaml
├── hs-gql-codegen.yaml
└── src/
    ├── MyProject.hs
    └── MyProject/
        ├── Gen.hs
        ├── Users/
        │   ├── API.hs
        │   ├── Resolvers.hs
        │   ├── Gen.hs
        │   └── users.graphql
        └── Posts/
            ├── API.hs
            ├── Resolvers.hs
            ├── Gen.hs
            └── posts.graphql
```

## GraphQL schema definition

The schema would be defined in separate `.graphql` files to keep the schema definition close to the relevant domain.

```graphql
# users.graphql

type User {
  id: ID! # IDs in the GraphQL spec are strings
  name: String!

  # contrived example to show arguments
  isOlderThan(age: Int!): Boolean!
}

extend type Query {
  users: [User!]!
  user(id: ID!): User
}
```

```graphql
# posts.graphql

type Post {
  id: ID!
  title: String!
  author: User!
}

extend type User {
  posts: [Post!]!
}

extend type Query {
  posts: [Post!]!
  post(id: ID!): Post
}
```

Notice how `posts.graphql` adds the `posts` field to the `User` type. The `MyProject.Users` module shouldn't know anything about posts, so it doesn't make sense to define the `posts` field in that schema file.

## Code generation

In `hs-gql-codegen.yaml`, we'd define configuration for the code generation.

```yaml
# find all '.graphql' files matched by this pattern, and
# generate 'Gen.hs' files next to them
files: src/**/*.graphql

# define the models representing each GraphQL type
types:
  User: MyProject.Users.API.User
  Post: MyProject.Posts.API.Post

# the monad to execute resolvers in, defaults to IO?
resolverMonad: MyProject.Monad.MyMonad
```

and then it would generate `Gen.hs` files with something like

```hs
-- MyProject.Users.Gen

import MyProject.Monad (MyMonad)
import MyProject.Users.API (User)

-- The GQLResolver type family would be defined in the
-- GraphQL framework

type instance GQLResolver User "id" = User -> MyMonad Text
type instance GQLResolver User "name" = User -> MyMonad Text
type instance GQLResolver User "isOlderThan" = UserIsOlderThanArgs -> User -> MyMonad Bool

type instance GQLResolver Query "users" = MyMonad [User]
type instance GQLResolver Query "user" = QueryUserArgs -> MyMonad [User]

data UserIsOlderThanArgs = UserIsOlderThanArgs
  { age :: Int
  }

data QueryUserArgs = QueryUserArgs
  { id :: Text
  }
```

```hs
-- MyProject.Posts.Gen

import MyProject.Monad (MyMonad)
import MyProject.Posts.API (Post)
import MyProject.Users.API (User)

type instance GQLResolver Post "id" = Post -> MyMonad Text
type instance GQLResolver Post "title" = Post -> MyMonad Text
type instance GQLResolver Post "author" = Post -> MyMonad User

type instance GQLResolver User "posts" = User -> MyMonad [Post]

type instance GQLResolver Query "posts" = MyMonad [Post]
type instance GQLResolver Query "post" = QueryPostArgs -> MyMonad [Post]

data QueryPostArgs = QueryPostArgs
  { id :: Text
  }
```

It would also generate a top-level `Gen.hs` file containing definitions describing the full schema.

```hs
-- MyProject.Gen

-- Constraint that checks that all resolvers have
-- been implemented
type AllFieldsResolved =
  ( ResolveField User "id"
  , ResolveField User "name"
  , ResolveField Post "id"
  , ResolveField Query "users"
  , ...
  )

-- All the schema information parsed from the schema
-- files, to be used at runtime, when executing a query
allGQLTypeDefs :: AllFieldsResolved => [GQLTypeDef]
allGQLTypeDefs =
  [ GQLTypeDef
      { name = "Query"
      , fields =
          [ -- GQLTypeFieldDef would be a GADT storing
            -- the ResolveField constraint for the proxy
            GQLTypeFieldDef
              { name = "users"
              , description = Nothing
              , proxy = Proxy :: Proxy (Query, "users")
              , result =
                  GQLTypeNonNull $
                  GQLTypeList $
                  GQLTypeNonNull $
                  GQLType "User"
              , directives = mempty
              }
          , ...
          ]
      , description = Nothing
      }
  , ...
  ]
```

## App code

`API.hs` contains the business logic, including database queries and the model types. The types here (e.g. `UserId` and `User`) could be the types generated by `persistent`, for example.

```hs
-- MyProject.Users.API

newtype UserId = UserId Int

data User = User
  { userId :: UserId
  , userName :: Text
  , userAge :: Int
  }

-- database functions
getUsers :: MyMonad [User]
getUser :: UserId -> MyMonad User
```

```hs
-- MyProject.Posts.API

newtype PostId = PostId Int

data Post = Post
  { postId :: PostId
  , postTitle :: Text
  , postAuthorId :: UserId
    -- ^ this could be represented by a foreign key in
    -- the database. Storing UserId here instead of User
    -- would allow us to avoid a JOIN if the client only
    -- requests a post's title, at the cost of making
    -- another DB query every time Post.author is queried
  }

-- database functions
getPosts :: MyMonad [Post]
getPostsForUser :: UserId -> MyMonad [Post]
getPost :: PostId -> MyMonad Post
```

`Resolvers.hs` would then connect the API functions with the resolver implementations.

```hs
-- MyProject.Users.Resolvers

import MyProject.Users.API
import MyProject.Users.Gen

-- ResolveField would be defined in the GraphQL framework:
--
--   class ResolveField ty field where
--     resolve :: GQLResolver ty field

instance ResolveField User "id" where
  resolve = pure . Text.pack . show . userId

instance ResolveField User "name" where
  resolve = pure . userName

instance ResolveField User "isOlderThan" where
  resolve UserIsOlderThanArgs{age} = pure . (> age) . userAge

instance ResolveField Query "users" where
  resolve = getUsers

instance ResolveField Query "user" where
  resolve QueryUserArgs{id} = getUser . UserId . read . Text.unpack $ id
```

```hs
-- MyProject.Posts.Resolvers

import MyProject.Users.API (User, getUser)
import MyProject.Posts.API
import MyProject.Posts.Gen

instance ResolveField Post "id" where
  resolve = pure . Text.pack . show . postId

instance ResolveField Post "title" where
  resolve = pure . postTitle

instance ResolveField Post "author" where
  resolve = getUser . postAuthorId

instance ResolveField User "posts" where
  resolve = getPostsForUser . userId

instance ResolveField Query "posts" where
  resolve = getPosts

instance ResolveField Query "post" where
  resolve QueryPostArgs{id} = getPost . PostId . read . Text.unpack $ id
```

Finally, `MyProject.hs` would define the full server with all resolvers registered:

```hs
import MyProject.Gen
import MyProject.Posts.Resolvers ()
import MyProject.Users.Resolvers ()

-- Since 'allGQLTypeDefs' has the 'AllFieldsResolved'
-- constraint, this will fail at compile time if you
-- forget to implement or import a ResolveField instance
server :: GQLServer
server = compileServer allGQLTypeDefs
```

## Conclusion

Of course, I haven't tried implementing any of this code, but conceptually, it should be possible to get this working. It might even be possible to use `graphql` under the hood, with `compileServer` building up a `Language.GraphQL.Type.Schema` value using the information in `allGQLTypeDefs`. But I definitely don't have time to actually work on this, so here's my wish list as a blog post; if this sounds like an interesting project, contact me and I'd be happy to flesh it out a bit more.
