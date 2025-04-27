---
title: Debugging Python f-string errors
---

Today, I encountered a fun bug where `f"{x}"` threw a TypeError, but `str(x)` worked. Join me on my journey unravelling what f-strings do and uncovering the mystery of why an object might not be what it seems.

## The initial problem

We have some code that deserializes data with a type hint, and I added a line that did:

```py
raise ValueError(f"{value} does not match {type_hint}")
```

But when this branch was encountered, we got this cryptic error:
```text
TypeError: descriptor '__format__' for 'datetime.date' objects doesn't apply to a 'str' object
```

After some debugging, I found the following behavior:
```python
>>> print(type_hint)
# <class 'datetime.datetime'>

>>> print(str(type_hint))
# <class 'datetime.datetime'>

>>> print(f"{type_hint}")
# TypeError: descriptor '__format__' for 'datetime.date' objects doesn't apply to a 'str' object
```

What?? I thought all of these would be equivalent!

## Debugging the error

How the heck is that error even triggered??

```python
>>> from datetime import datetime

>>> datetime.now().__format__()
# TypeError: __format__() takes exactly 1 argument (0 given)

>>> datetime.now().__format__("")
# '2025-04-26 11:30:10.914804'

>>> datetime.__format__("")
# TypeError: descriptor '__format__' for 'datetime.date' objects doesn't apply to a 'str' object
```

Aha! So `__format__` is meant to be called on an instance, so when called on a class with a string (that's meant to be the second arg after `self`), we get this error that `self` is supposed to be a `date` object (`datetime` inherits `__format__` from `date`). But why the heck is it being called that way?

Let's go another direction:

```python
>>> print(datetime)
# <class 'datetime.datetime'>

>>> print(type_hint)
# <class 'datetime.datetime'>

>>> type_hint is datetime
# False
```

Wait, printing out `type_hint` says it's a `datetime` class object, but it's not equal to the `datetime` object we imported ourselves??

```python
>>> print(f"{datetime}")
# <class 'datetime.datetime'>

>>> print(f"{type_hint}")
# TypeError: descriptor '__format__' for 'datetime.date' objects doesn't apply to a 'str' object
```

Fun. Okay so the normal `datetime` class itself interpolates fine, but not whatever `type_hint` is, even though it claims to be `datetime`.

## Detour: what does f-string do?

At this point, it's clear that my mental model of `f"{v}" == str(v)` is incorrect, so I tried digging into what `f"{v}"` actually desugars to. After a couple hours of searching the docs and reading CPython source code (yeah, I was desperate), I finally found the breakdown.

```python
f"{v}"

# ==>
format(v, "")

# ==>
type(v).__format__(v, "")
```

Turns out, there's a small line in the [f-strings section](https://docs.python.org/3/reference/lexical_analysis.html#f-strings) (not to be confused with the [Formatted String Literals section](https://docs.python.org/3/tutorial/inputoutput.html#formatted-string-literals)) that says:

> The result is then formatted using the format() protocol.

Which specifies:

> A call to `format(value, format_spec)` is translated to `type(value).__format__(value, format_spec)`

In most cases, `__format__` with an empty format spec is equivalent to `str()`... but of course, you can override it to be anything in a custom type. _(~~ Foreshadowing ~~)_

## Revealing the bug

At this point, I went down multiple other rabbit holes. Sadly, it didn't occur to me to double check `type(type_hint)` until later, which uncovered everything:
```python
>>> type(type_hint)
# <class 'temporalio.worker.workflow_sandbox._restrictions._RestrictedProxy'>
```

Ah. This deserialization code was for deserializing messages sent via [Temporal](https://temporal.io), which does some sandboxing around imports. So apparently, Temporal will replace the imported `datetime` with a proxy, which is why, in most cases, `type_hint` was indistinguishable from `datetime`.

If we look at the [source code](https://github.com/temporalio/sdk-python/blob/1.9.0/temporalio/worker/workflow_sandbox/_restrictions.py#L916), we can see that it proxies all magic methods through to a lookup class:

```python
# Simplified for clarity

class _RestrictedProxy:
    __format__ = _RestrictedProxyLookup("__format__")

    def __init__(self, obj):
        self.__obj = obj

class _RestrictedProxyLookup:
    def __init__(self, name, access_func = None):
        self.name = name
        self.bind_func = access_func

    def __call__(self, instance: _RestrictedProxy, *args, **kwargs):
        obj = instance.__obj
        if self.bind_func:
            return self.bind_func(obj, *args, **kwargs)
        else:
            return getattr(obj, self.name)(*args, **kwargs)
```

The problem was that `__format__` is not passing any function to the lookup object, which results in the following call stack:

```python
f"{proxied_datetime}"

# ==> f-string desugaring
format(proxied_datetime, "")
type(proxied_datetime).__format__(proxied_datetime, "")
_RestrictedProxy.__format__(proxied_datetime, "")

# ==> result of __call__ when self.bind_func is None
getattr(real_datetime, "__format__")("")

# ==> evaluate getattr()
real_datetime.__format__("")
# TypeError: descriptor '__format__' for 'datetime.date' objects doesn't apply to a 'str' object
```

Turns out this was [fixed](https://github.com/temporalio/sdk-python/pull/757#discussion_r1949629666) in 1.10.0 (which we aren't on because we're still using Python 3.8) with a simple change:
```diff
 class _RestrictedProxy:
-    __format__ = _RestrictedProxyLookup("__format__")
+    __format__ = _RestrictedProxyLookup("__format__", format)
```

Now, `self.bind_func` is no longer `None`, which results in the correct call stack:

```python
f"{proxied_datetime}"

# ==> f-string desugaring
format(proxied_datetime, "")
type(proxied_datetime).__format__(proxied_datetime, "")
_RestrictedProxy.__format__(proxied_datetime, "")

# ==> result of __call__ now that self.bind_func is the `format` function
format(real_datetime, "")
# <class 'datetime.datetime'>'
```

Alas, that's 3 hours I won't get back.
