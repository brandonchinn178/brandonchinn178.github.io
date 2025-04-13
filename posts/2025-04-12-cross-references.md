---
title: A system of star-crossed references
---

At LeapYear, we had a system of cross-references that turned out to be pretty handy. One common situation was if we wrote a comment explaining a complicated piece of logic and we want to "link" back to that comment at various parts of the code, but we want to make sure that "link" doesn't get broken in the future.

Basically, we had tags `@@(foo)` commented at the source location and `^^(foo)` at other locations, so if you saw `^^(foo)` anywhere, you could do a quick search for `@@(foo)` to find where it's linked to. Then, we had a quick linter that found all `^^(foo)` tags and validated that `@@(foo)` exists somewhere.

Shout-out to David Thomas for originally coming up with this system, it was really useful to have!

## Examples

**ARCH.md**
```md
Some markdown content explaining core architecture.

<!-- @@(core-arch-phase-1) -->
Phase 1 involves stuff.

<!-- @@(core-arch-phase-2) -->
Phase 2 involves stuff.
```

**phase1.py**
```py
class Phase1Runner:
    """
    Execute phase 1.

    See ^^(core-arch-phase-1)
    """

# @@(magic-num-123)
#
# Share this number with Haskell, without autogenerating code!
# If someone updates the number, they'll notice they should update
# the cross reference as well, and the linter will check that they've
# updated all the references.
MAGIC_NUM = 123
```

**phase2.hs**
```haskell
-- | Execute phase 2.
--
-- See ^^(core-arch-phase-2)
executePhase2 :: IO ()

-- \^^(magic-num-123)
--
-- We had to be careful about using ^^ at the beginning of comments in
-- Haskell, as "-- ^ ..." is the docstring syntax. We actually changed
-- the syntax for tags because we used so much Haskell, but escaping the
-- tag also works.
magicNum :: Int
magicNum = 123
```

**serialize.py**
```py
def serialize(val):
    # FooSingleton is not JSON serializable, so mock it out
    # @@(serialize-foo-singleton)
    if val is FooSingleton:
        return "__FOO__"
    return json.dumps(val)

def deserialize(data, *, type_hint):
    # ^^(serialize-foo-singleton)
    if type_hint is FooSingleton:
        return FooSingleton
    return json.loads(data)
```

**model.py**
```py
class FooEnum(Enum):
    FOO = 1
    # @@(foo-enum-hack)
    FOO_HACK = 2

def execute_foo():
    # Because FOO_HACK is an option, we have to do this
    # ^^(foo-enum-hack)
    #
    # This way, if someone deletes FOO_HACK and the reference, they'll get
    # notified to delete this part too, which they wouldn't have been
    # made aware of otherwise
    # (imagine if this were in some other file far away)
    requests.post("https://foo.com/hack")
```

## Script to validate cross references

```python
#!/usr/bin/env python3

import collections
import re
import subprocess

def main():
    labels = get_tags("@@")
    refs = get_tags("^^")

    duplicates = get_duplicates(labels)
    if duplicates:
        raise Exception(f"Found duplicate labels: {duplicates}")

    labels = set(labels)
    refs = set(refs)

    unknown = refs - labels
    if unknown:
        raise Exception(f"Found broken references: {unknown}")

    unused = labels - refs
    if unused:
        print(f"WARNING: Found unreferenced labels: {unused}")

def get_tags(prefix: str) -> list[str]:
    proc = subprocess.run(
        ["git", "grep", "-FhI", f"{prefix}("],
        check=True,
        stdout=subprocess.PIPE,
        text=True,
    )
    return re.findall(re.escape(prefix) + r"\(([\w\s_-]+)\)", proc.stdout)

def get_duplicates[T](vals: list[T]) -> list[T]:
    counter = collections.Counter(vals)
    return [val for val, count in counter.items() if count > 1]

if __name__ == "__main__":
    main()
```
