---
layout: post
title: Refactoring strings in GHC
---

In the summer of 2024, I merged two changes into GHC related to strings:
1. [Implement multiline strings](https://gitlab.haskell.org/ghc/ghc/-/merge_requests/12089)
2. [Replace manual lexing of strings](https://gitlab.haskell.org/ghc/ghc/-/merge_requests/13128)

This work involved a lot of refactoring to how strings were lexed in GHC, with a lot of tricky spots with performance, considering how ubiquitous string literals are in Haskell programs. In this blog post, I will outline a few interesting takeaways from this experience.

## Context + Motivation

GHC uses `alex` to lex an input bytestring into tokens. At a high level, `alex` allows specifying a regex to search for, then run a callback with the substring matching that regex. Generally speaking, GHC will specify a full regex for a lexical entity (e.g. `[0-9]+`) and output a token (e.g. `\s -> ITinteger (read s)`). But for strings, GHC would match the initial double quote character, then manually iterate character-by-character until seeing another double quote.

The initial motivation for this was probably performance, to resolve escape characters at the same time as iterating the input. But it came at the cost of readability; with this implementation, it's difficult to verify if the string lexer conforms to the [Haskell report](https://www.haskell.org/onlinereport/haskell2010/haskellch10.html#x17-17700010.2), which defines a string as simply:

```text
string -> " { graphic<" | \> | space | escape | gap } "
```

That is, a string consists of:
1. A double quote
1. Then one or more of either:
    * A graphical character (except for double quotes or backslashes)
    * A space character
    * An escaped character, or
    * A string gap
1. Then a final double quote

When starting to implement multiline strings, the issues were exacerbated:
1. It's even harder to tell if multiline strings conform to the extended Haskell Report as specified in the proposal
1. Multiline strings need to defer escaping characters until after reading all the characters in, which means decoupling the logic where these are done simultaneously
    * See [proposal](https://github.com/ghc-proposals/ghc-proposals/pull/569) for more details

## Sharing code between normal strings and multiline strings

TODO: multiline strings needed to defer escaping characters, discuss `>=>` vs abstracted manual iteration

## Using alex regexes for strings

TODO: two passes

## Using alex regexes for multiline strings

TODO: multiline strings manual lexing with hybrid approach
