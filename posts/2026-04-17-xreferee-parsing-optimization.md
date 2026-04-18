---
title: xreferee parsing optimization
---

[xreferee](https://github.com/brandonchinn178/xreferee) is a linter that checks that every `@(ref:foo)` reference in a git repository corresponds to a `#(ref:foo)` anchor somewhere in the repository. It delegates most of the search to `git grep`, but there's some parsing logic to parse `git grep`'s output. In a [recent PR](https://github.com/brandonchinn178/xreferee/pull/20), I was able to get a 5x speedup with two changes:
1. Switch from `LazyText` to `LazyByteString`
2. Switch from `break` to `elemIndex`

## Context

xreferee runs this `git grep` command:
```bash
git grep -z --full-name --line-number --column -I --fixed-strings -e "@(ref:" -e "#(ref:"
```

This returns output with lines of the form:
```
src/Foo/Bar.hs\NUL1\NUL14\NUL  foo = 1 -- @(ref:foo)
```

That is, a `\NUL`-separated string of:
* The filepath
* The line number
* The column the match starts on
* The content of the line

I need to parse out (potentially multiple) markers on that line. The column number is helpful as I can immediately drop all the characters up to that index. In the common case, the line is short (< 100 chars) and there's only one marker, so this should be really fast. Indeed, parsing "normal" files shows barely any difference in the two implementations (~10% speedup).

For the rest of this analysis, we'll focus on the degenerate case: really long lines (e.g. 25,000 characters) with multiple refs/anchors on the same line.

## Implementing the optimization

### Step 0: The original algorithm

The original algorithm was a function `parseLabels :: Text -> ([Anchor], [Ref])` that took the line to parse (with the column number in the `git grep` output already dropped) and did the following:

1. Get the first characters of each marker, i.e. `@` and `#`
2. Break the string to the first marker that matches: ``Text.break (`elem` starts)``
    * If no matches, return
3. Try to parse the full marker, and if it succeeds, loop on the rest of the string
    * If it doesn't succeed, this is a false positive. We drop the first character and try again. We'll ignore false positives for this analysis.

As mentioned before, the common case is really short lines, so the performance here doesn't really matter. But my attention was brought back to the project and I decided I would ask AI if there was a more performant option here. After some back and forth, AI made a passing comment about ByteString, which I asked for more details on, and AI elaborated on two major optimizations.

### Step 1: Text to ByteString

The first optimization was switching from lazy Text to lazy ByteString. It turns out that this has quite a few benefits:

* If a git repo contains non-UTF-8 files, `git grep` could output non-UTF-8 lines, and decoding to Text could fail. Keeping it as ByteString would avoid the potential decode failure.
* Most of the input is probably not a marker, so most of the input will be dropped. Keeping as ByteString means we can avoid decoding UTF-8 text for all the characters we dropped.

This shows a bit of performance improvement, but the big improvement is the next change.

### Step 2: `break` to `elemIndex`

At this point, the algorithm uses ``LBS.break (`elem` starts)``, which will iterate on each byte and find one that matches one of the starting marker bytes. Turns out this is super slow! Indeed, profiling shows that 30% of the time is spent on the `==` operation. Instead of using `break` to check for both marker types at once, we can use `elemIndex` twice:

```hs
let anchorStart = 64 -- '@'
    refStart = 35 -- '#'
    anchorIndex = LBS.elemIndex anchorStart s
    refIndex = LBS.elemIndex refStart s
```

`elemIndex` uses the [`memchr`](https://www.man7.org/linux/man-pages/man3/memchr.3.html) C function, which is super fast, much faster to do twice than to do one `break` call.

The algorithm then becomes:

1. Get the first characters of each marker, i.e. `@` and `#`
    * Converted to `Word8`
2. Get the first index for each marker: ``LBS.elemIndex anchorStart s``
    * If neither marker start is found, return
    * If both are found, use the smaller one.
        * Using a helper: `minMaybe :: Ord a => Maybe a -> Maybe a -> Maybe (Either a a)`
3. Try to parse the full marker, and if it succeeds, loop on the rest of the string

## Benchmarks

After making these changes, I ran the executable before/after the change with `hyperfine`:

```
Benchmark 1: ./xreferee-old
  Time (mean ± σ):      7.243 s ±  0.021 s    [User: 6.874 s, System: 0.895 s]
  Range (min … max):    7.211 s …  7.276 s    10 runs

  Warning: Ignoring non-zero exit code.

Benchmark 2: ./xreferee-new
  Time (mean ± σ):      1.253 s ±  0.009 s    [User: 1.365 s, System: 0.308 s]
  Range (min … max):    1.241 s …  1.268 s    10 runs

  Warning: Ignoring non-zero exit code.

Summary
  ./xreferee-new ran
    5.78 ± 0.05 times faster than ./xreferee-old
```

The repo has really large files used as test fixtures, which is why we see these results. If we ignore the test fixture directory, the performance optimization is negligible:

```
Benchmark 1: ./xreferee-old -Idata
  Time (mean ± σ):      16.3 ms ±   0.7 ms    [User: 5.3 ms, System: 5.5 ms]
  Range (min … max):    14.0 ms …  17.1 ms    156 runs

  Warning: Ignoring non-zero exit code.
  Warning: Statistical outliers were detected. Consider re-running this benchmark on a quiet system without any interferences from other programs. It might help to use the '--warmup' or '--prepare' options.

Benchmark 2: ./xreferee-new -Idata
  Time (mean ± σ):      15.8 ms ±   0.8 ms    [User: 5.2 ms, System: 5.4 ms]
  Range (min … max):    13.8 ms …  16.8 ms    154 runs

  Warning: Ignoring non-zero exit code.

Summary
  ./xreferee-new -Idata ran
    1.03 ± 0.07 times faster than ./xreferee-old -Idata
```

And here are the profiling results:

```
	   xreferee-old +RTS -p -RTS

	total time  =       12.09 secs   (12093 ticks @ 1000 us, 1 processor)
	total alloc = 5,554,610,256 bytes  (excludes profiling overheads)

COST CENTRE               MODULE                        SRC                                                                   %time %alloc

==                        GHC.Classes                   libraries/ghc-prim/GHC/Classes.hs:218:5-42                             30.4    0.0
elem                      GHC.Internal.List             libraries/ghc-internal/src/GHC/Internal/List.hs:1544:1-4               29.9    0.0
eqChar                    GHC.Classes                   libraries/ghc-prim/GHC/Classes.hs:301:8-15                             15.6    0.0
$wbreak                   Data.Text.Lazy                libraries/text/src/Data/Text/Lazy.hs:1429:1-5                           9.5   73.3
$wunpack                  Data.Text.Internal.IO         <no location info>                                                      4.3    5.9
$wutf8_decode             GHC.Internal.IO.Encoding.UTF8 libraries/ghc-internal/src/GHC/Internal/IO/Encoding/UTF8.hs:154:1-11    2.8    0.0
rnf                       XReferee.SearchResult         src/XReferee/SearchResult.hs:97:3-76                                    2.3    0.0
findRefsFromGit.parseLine XReferee.SearchResult         src/XReferee/SearchResult.hs:(128,5)-(143,11)                           1.7    0.9
$s$wnext                  Data.Text.Lazy                <no location info>                                                      0.1    5.2
commonPrefixes_$s$wgo     Data.Text.Lazy                libraries/text/src/Data/Text/Lazy.hs:1767:5-6                           0.1    1.3
```

```
	   xreferee-new +RTS -p -RTS

	total time  =        0.91 secs   (906 ticks @ 1000 us, 1 processor)
	total alloc = 1,099,993,328 bytes  (excludes profiling overheads)

COST CENTRE                      MODULE                                    SRC                                                                                %time %alloc

rnf                              XReferee.SearchResult                     src/XReferee/SearchResult.hs:106:3-76                                               50.4    0.0
throwErrnoIfMinus1RetryMayBlock2 GHC.Internal.Foreign.C.Error              <no location info>                                                                   6.0    0.0
findRefsFromGit.parseLine        XReferee.SearchResult                     src/XReferee/SearchResult.hs:(137,5)-(153,11)                                        3.5    2.0
$fOrdText_$ccompare              Data.Text                                 libraries/text/src/Data/Text.hs:371:5-11                                             3.4    0.0
elemIndex                        Data.ByteString.Lazy                      libraries/bytestring/Data/ByteString/Lazy.hs:1219:1-9                                2.6    0.9
$wloop1                          Data.ByteString.Internal.Type             <no location info>                                                                   2.3   10.4
hGetSome1                        Data.ByteString                           <no location info>                                                                   2.3   32.0
<>                               XReferee.SearchResult                     src/XReferee/SearchResult.hs:(60,3)-(64,7)                                           2.3    0.8
filepath                         XReferee.SearchResult                     src/XReferee/SearchResult.hs:88:5-12                                                 1.8    0.0
++                               GHC.Internal.Base                         libraries/ghc-internal/src/GHC/Internal/Base.hs:1985:1-4                             1.5    0.5
```

## Final thoughts

TIL about `elemIndex`, which is extremely fast. I also got a bit more intuition about Text vs ByteString. And lastly, while I still refuse to "vibecode", AI did a pretty good job pointing me in the right direction here, so I guess kudos for that.