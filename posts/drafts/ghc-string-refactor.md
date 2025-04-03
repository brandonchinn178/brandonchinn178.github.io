---
title: Refactoring strings in GHC
---

In the summer of 2024, I merged two changes into GHC related to strings:
1. [Implement multiline strings](https://gitlab.haskell.org/ghc/ghc/-/merge_requests/12089)
2. [Replace manual lexing of strings](https://gitlab.haskell.org/ghc/ghc/-/merge_requests/13128)

This work involved a lot of refactoring to how strings were lexed in GHC, with a lot of tricky spots with performance, considering how ubiquitous string literals are in Haskell programs. In this blog post, I will outline a few interesting takeaways from this experience.

<!-- excerpt -->

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

At the end of the day, I was able to refactor the code into something like:

<table>
<tr><th>Old code</th><th>New code</th></tr>
<tr><td>

```c
onRegex('"', (_) => {
    chars = []
    while true {
        c <- popNextChar
        switch (c) {
            case '"':
                return chars
            case '\\':
                c <- peekNextChar
                if isSpace(c) {
                    skipStringGap
                } else {
                    c <- lexEscapeCode
                    chars += c
                }
            default:
                chars += c
        }
    }
})
```

</td><td>

```c
onRegex('"[^"]*"', (chars) => {
    chars = removeStringGaps(chars)
    chars = resolveEscapes(chars)
    return chars
})
```

</td></tr></table>

## Sharing code between normal strings and multiline strings

Fundamentally, string processing requires running the following steps, with shared steps bolded:

<table>
    <tr>
        <th>Normal strings</th>
        <th>Multiline strings</th>
    </tr>
    <tr>
        <td>
            <ol>
                <li><strong>Collapse gaps</strong></li>
                <li><strong>Resolve escape characters</strong></li>
            </ol>
        </td>
        <td>
            <ol>
                <li><strong>Collapse gaps</strong></li>
                <li>Split newlines</li>
                <li>Remove common whitespace prefix</li>
                <li>Rejoin newlines</li>
                <li><strong>Resolve escape characters</strong></li>
            </ol>
        </td>
    </tr>
</table>

Notably, resolving escape characters could throw an error; `\xffffff` is an invalid escape character. So generally speaking, one could think of the post processing steps as a pipeline of `String -> Either LexError String` functions stitched together with `>=>`:

```hs
processNormal :: String -> Either LexError String
processNormal =
      collapseGaps
  >=> resolveEscapes

processMultiline :: String -> Either LexError String
processMultiline =
      collapseGaps
  >=> splitNewlines
  >=> rmCommonWhitespacePrefix
  >=> joinNewlines
  >=> resolveEscapes
```

This had a certain elegance to it; if we need to add another failable step in the middle of the pipeline, you can just slot it in. But when I implemented it, we noticed a huge tick in memory usage. Turns out, the use of `Either` with `>=>` compiles into a series of `let` statements, and each `let` statement (as I learned!) corresponds to a heap allocation. Luckily, it turns out that only `resolveEscapes` is failable, so we can keep things pure until the very end. This does mean that if we need to add another failable step to the pipeline, we'll be a bit stuck, but we can figure that out if we get there.

## Including source location in error messages

After refactoring string processing into the above steps, I encountered another issue. Previously, when we were iterating character-by-character, if we encountered an invalid escape character, we threw an error with the location that we were currently at.

```text
example.hs:1:16: error: [GHC-21231]
    numeric escape sequence out of range at character '0'

    a = "Hel\x6c000000000000000 World"
    ~~~~~~~~~~~~~~~^
```

So naively, to know the location of a character when we throw an error in `resolveEscapes`, we'd have to pass around `[(Char, Pos)]` instead of `[Char]`, which means an extra allocation (for the tuple) for every character in the string. We can't just take the lists separately and pass the `[Pos]` directly to `resolveEscapes` because some of the steps may remove or replace characters (e.g. `collapseGaps`).

The trick I used here was to do the following:
1. Define the pipeline steps (e.g. `collapseGaps`, `resolveEscapes`) as a polymorphic function `HasChar c => [c] -> Either LexError [c]`
1. Call the function the first time, optimistically, as `[Char]`. If that passes, no increased memory usage
1. If that fails, we'll swallow the error and call it a second time with `[(Char, Pos)]`
    1. This takes a performance + memory hit, but it only happens on an error, when presumably you wouldn't mind a slightly longer wait for better error messages

With some pattern synonyms and some care to concretize the types (to ensure GHC inlines everything), the code is much more readable, with roughly the same performance characteristics, than before!

## Using alex regexes for strings

Now that I split out the post-processing steps, I was now free to replace the manual character-by-character iteration code with a regex! Now, instead of tracing through the logic to see if it lexes an escape code correctly, you can just look at the (simplified) grammar below and see that it matches the report:

```text
-- Character sets

$space = " "
$whitechar = [\n \v $space]

$small = [a-z]
$large = [A-Z]

$digit = 0-9
$octit = 0-7
$hexit = [$digit A-F a-f]

$special = [\(\)\,\;\[\]\`\{\}]
$symbol  = [\!\#\$\%\&\*\+\.\/\<\=\>\?\@\\\^\|\-\~\:]
$graphic = [$small $large $symbol $digit $special \_ \" \']

-- Macros

@decimal     = $digit*
@octal       = $octit*
@hexadecimal = $hexit*

@gap   = \\ $whitechar+ \\
@cntrl = $asclarge | \@ | \[ | \\ | \] | \^ | \_
@ascii = \^ @cntrl | "NUL" | "SOH" | "STX" | "ETX" | "EOT" | "ENQ" | "ACK"
       | "BEL" | "BS" | "HT" | "LF" | "VT" | "FF" | "CR" | "SO" | "SI" | "DLE"
       | "DC1" | "DC2" | "DC3" | "DC4" | "NAK" | "SYN" | "ETB" | "CAN"
       | "EM" | "SUB" | "ESC" | "FS" | "GS" | "RS" | "US" | "SP" | "DEL"

@escape     = \\ ( $charesc | @ascii | @decimal | o @octal | x @hexadecimal )
@stringchar = ($graphic # [\\ \"]) | $space | @escape | @gap

-- Expressions

\" @stringchar* \"
```

That `@stringchar` definition is practically the definition in the Haskell report verbatim!

## Using alex regexes for multiline strings

TODO: multiline strings manual lexing with hybrid approach
