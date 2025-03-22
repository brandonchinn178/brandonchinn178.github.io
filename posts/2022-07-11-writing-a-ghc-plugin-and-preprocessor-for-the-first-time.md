---
title: "Writing a GHC Plugin + Preprocessor for the first time"
---

I just released a new library `tasty-autocollect`, which aims to solve a lot of minor annoyances I've had with `tasty-discover`. I won't be going into too much detail about what it does (see the [README](https://github.com/brandonchinn178/tasty-autocollect#readme) instead), but I wanted to quickly go over some of the technical hurdles in implementing the library, and what I learned in this process.

First, a brief technical overview: the library should be installed by adding `-F -pgmF=tasty-autocollect` in the `package.yaml` or `.cabal` file. This registers a preprocessor for every file. Then it detects if the file is the main file, a test file, or neither. If it's a main file, it does a search for test files and generates a main file for compilation. If it's a test file, it registers the `Test.Tasty.AutoCollect.ConvertTest` plugin. Otherwise, it leaves the file alone. The plugin will then do the rewrite magic in the tests to be consumed by the generated main file.

# Wait, a preprocessor AND a plugin??

Yup! Here's why:

1. Rewriting the test files is much easier to do by modifying the parsed GHC AST instead of doing text manipulation, which requires a plugin.

    * I could do this in the preprocessor (parse, modify, then reoutput as text), but then the file would be parsed twice: once in the preprocessor, and once in the actual compilation step. Plus, I don't fully trust that the parse/reoutput-as-text cycle is not lossy.

    * As an aside, `tasty-discover` doesn't do this currently, because it finds tests by looking at the first lexeme in every line and sees if it matches a test pattern ([ref](https://github.com/haskell-works/tasty-discover/blob/f755f7afbec2653495bbd9a98c1827911318e9fd/src/Test/Tasty/Discover/Internal/Driver.hs#L107-L112)). This means that `tasty-discover` actually incorrectly finds tests that are commented out with a block comment. ([GitHub issue](https://github.com/haskell-works/tasty-discover/issues/10))

2. Generating the main file seems to only be possible with a preprocessor.

    * GHC plugins only run while a module is being compiled, so the plugin can't influence the order modules are compiled. So GHC might try to build the main file before any of the test files are built, and even if I could add import statements to the main file when modifying the GHC AST, it would be too late for GHC to reparse the imports and realize it needs to build other things.

    * Furthermore, I also had random issues with adding imports in a plugin, e.g. [this issue](https://gitlab.haskell.org/ghc/ghc/-/issues/21730).

This was my first attempt at writing either a preprocessor or a GHC plugin, so this was a really great learning project for me. The two things that helped the most for me was having experience with Template Haskell and also upgrading packages to new GHC versions.

# CPP

Since I'm writing a GHC plugin, I need to use a lot of GHC internals, but GHC is notorious for making a lot of breaking changes in its API. I decided to follow common practice and only support the last three GHC versions (8.10, 9.0, 9.2), but it was still a decent amount of effort. Here are a couple examples of the breaking changes in these three versions:

* GHC 8.10 -> 9.0 changed from a flat module structure (e.g. `import ApiAnnotation`) into a hierarchical one (e.g. `import GHC.Parser.Annotation`)

* GHC 9.0 -> 9.2 added a bunch more location information throughout the AST, changing a simple `L srcSpan element` to `L (SrcSpanAnn (EpAnn ...) srcSpan) element`

The most straightforward way to handle these breakages would be to do something like

```hs
case loc of
#if MIN_VERSION_ghc(9,0,0)
  RealSrcSpan s _ ->
#else
  RealSrcSpan s ->
#endif
    foo s
  UnhelpfulSpan _ -> bar
```

but it's rather ugly, and it also [wreaks havoc with Fourmolu](https://github.com/tweag/ormolu/blob/master/DESIGN.md#cpp). After some searching, I came across [this link](https://www.reddit.com/r/haskell/comments/2uehlo/stop_abusing_cpp_in_haskell_sources/), and thought it would be a good design for this library.

When I was finished prototyping and getting it working with a single GHC version, I broke out a `GHC.hs` utilities module. Then, to support multiple GHC versions, I first created the following module tree:

```
GHC.hs
GHC/Shim.hs
GHC/Shim_Common.hs
GHC/Shim_8_10.hs
GHC/Shim_9_0.hs
GHC/Shim_9_2.hs
```

Then I updated `package.yaml`:

```yml
other-modules:
  - Test.Tasty.AutoCollect.GHC
  - Test.Tasty.AutoCollect.GHC.Shim
  - Test.Tasty.AutoCollect.GHC.Shim_Common
when:
  - condition: impl(ghc >= 9.2) && impl(ghc < 9.4)
    other-modules:
      - Test.Tasty.AutoCollect.GHC.Shim_9_2
  - condition: impl(ghc >= 9.0) && impl(ghc < 9.2)
    other-modules:
      - Test.Tasty.AutoCollect.GHC.Shim_9_0
  - condition: impl(ghc >= 8.10) && impl(ghc < 9.0)
    other-modules:
      - Test.Tasty.AutoCollect.GHC.Shim_8_10
```

Finally, put it all together in `Shim.hs`:

```hs
{-# LANGUAGE CPP #-}

module Test.Tasty.AutoCollect.GHC.Shim (module X) where

import Test.Tasty.AutoCollect.GHC.Shim_Common as X
#if __GLASGOW_HASKELL__ == 810
import Test.Tasty.AutoCollect.GHC.Shim_8_10 as X
#elif __GLASGOW_HASKELL__ == 900
import Test.Tasty.AutoCollect.GHC.Shim_9_0 as X
#elif __GLASGOW_HASKELL__ == 902
import Test.Tasty.AutoCollect.GHC.Shim_9_2 as X
#endif
```

In the `GHC/Shim_X_X.hs` modules, I can then write the code specific to that GHC version. and it'll only be compiled + imported when that GHC version is compiling the project. Technically, the `MIN_VERSION_ghc(X,X,X)` pragma might be the more "correct" pragma to use, but I find it much easier to use `__GLASGOW_HASKELL__` and standard comparison operators than trying to do the right combination of `MIN_VERSION_ghc(8,10,0) && !MIN_VERSION_ghc(9,0,0)`.

These Shim modules export three types of things:

* Re-exporting GHC functions from the correct modules (e.g. 8.10 from `ApiAnnotation`, 9.0 + 9.2 from `GHC.Parser.Annotation`)

* Backporting functions
    * e.g. GHC 9.2 has `noAnn` to mark the lack of comments on most AST branches, but GHC 8.10 and 9.0 have `noExtField`, so the GHC 8.10 and 9.0 shims can just define `noAnn = noExtField`

* Abstracting over GHC details with common interface
    * e.g. instead of parsing raw `HsDecl` values where constructors have different arguments between GHC versions, we can just define our own `ParsedDecl` data type in `Shim_Common.hs` and have each GHC shim implement their own version of `parseDecl :: HsDecl -> Maybe ParsedDecl`. As a bonus, it allows us to encode only the constructors/parameters we actually care about.

Overall, the `CPP` extension is only enabled in two (!) modules: `Shim_Common.hs` and `Shim.hs`, and the `#if` conditionals only wrap import statements, which Fourmolu is relatively okay with.

## CPP in tests

Initially, I had a feature that could only be tested in GHC >= 9.2. The most straightforward way of doing this would be something like:

```hs
test_batch =
  [ testCase label $ ...
  | label <-
      [ "test 1"
      , "test 2"
      , ...
#if __GLASGOW_HASKELL__ >= 902
      , "test needing >= 9.2"
#endif
      , ...
      ]
  ]
```

But Fourmolu wasn't very happy with this. Then I came up with this neat trick:

```hs
#if __GLASGOW_HASKELL__ >= 902
#define __NEEDS_GHC_9_2__ True
#else
#define __NEEDS_GHC_9_2__ False
#endif

test_batch =
  [ testCase label $ ...
  | label <-
      concat
        [ ["test 1"]
        , ["test 2"]
        , ...
        , if __NEEDS_GHC_9_2__
            then ["test needing >= 9.2"]
            else []
        , ...
        ]
  ]
```

Which now allows Fourmolu to format everything as it wants. I did end up not needing this test anymore, but I'll definitely remember this trick if I need to test something per-GHC versions again.
