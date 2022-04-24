---
layout: post
title: "[RFC] EON: A simpler configuration format"
---

Do you like YAML's relative readability but dislike all the [ways a user could shoot themselves in the foot](https://noyaml.com/)? If you're like me, you probably agree that it's not the _user's_ job to remember that the file format they're using automatically converts `true`, `on`, `yes`, or `y` to a boolean TRUE[^1]. In other words, the semantics of the token `true` is not inherent to that token, but is determined by the field you're currently configuring.

For example, say you want a list of bash commands, where each command is represented as a list, with commands and arguments separated out:

```
commands:
  - [true]
  - [yes]
  - [chmod, 0700, foo.txt]
  - [git, add, *.txt]
```

This currently has the following issues:
* The first command would be the boolean `true`, not the Bash command `true`
* The second command would also be the boolean `true`, not the Bash command `yes`
* Depending on your YAML library implementation, the third command may parse `0700` as the number `700` or `448`
* The last command would throw an error, since `*` starts a YAML alias, and `.` is not a valid character in a YAML alias.

As the user, this is very much violating the principle of least surprise. As the developer, I can't do anything about this, since YAML does the type-conversion automatically before I get the value at all. So there's absolutely nothing I could do to get the user's actual input (e.g. I have no way of knowing if the user typed in `yes`); the onus is on the user to quote the value.

# Introducing the Easy Object Notation format

EON files are suffixed with `.eon` and should generally work with YAML syntax highlighting. Conceptually, EON parses to a JSON object[^2] containing objects, lists, strings, **_and nothing else_**. EON also provides a standard specification for other types, and EON implementations should provide parsers out-of-the-box for these types, but conceptually, all other types are parsed from strings.

This allows the user to write `x: true`, and the developer to determine whether that `true` is a boolean or a string. The core intuition here is that you generally aren't decoding data in a vacuum; you're generally deserializing some object that knows the types it wants for the fields. If you've ever decoded enums from JSON, you're probably already doing this extra step anyway.

This is still a rough draft, but it covers all the major points. If there's even a modicum of interest in this, I might put up an actual spec.

* Objects are basically the same as YAML: can use either indentation-based keys or `{}` syntax

    * Duplicate keys is an error
    * Order not guaranteed
    * Keys may optionally be quoted, to allow a key to include characters like `:`

* Lists are also basically the same as YAML: `- ` or `[]` syntax for lists

* All scalars are initially strings. Developers decide how to deserialize strings per-field.

    * There would be some first-class support for multiline strings, without needing quotes or `long_description: |` syntax or anything.
    * Scalars may optionally be quoted, to allow a string to start with `[` or `{` or something

* EON implementations must provide parsers out-of-the-box for basic types:

    * Boolean: `true` and `false` (case insensitive) map to TRUE and FALSE
    * Integer: arbitrary precision, supports binary, octal, hex
    * Float: arbitrary precision, supports scientific notation
    * Null: `null` should map to the language's idiomatic representation of NULL
    * Future: datetime types like TOML?

## API examples

Some potential API ideas for parsing the given config:

```
str_field: hello world
multi_field: { a: 1.5, b: 2.2 }
list_field:
  - 1
  - 2
  - 0xDEADBEEF
baz:
  state: ON
  required_nullable: null
```

### Python

```python
@dataclass
class Config:
    str_field: str
    optional_bool: bool | None
    multi_field: float | dict[str, float]
    list_field: list[int]
    baz: Baz

    @classmethod
    def __decode_eon__(cls, v: eon.Value) -> Config:
        o = v.object()
        return Config(
            str_field=o["str_field"].string(),
            optional_bool=o.optional(
                "optional_bool",
                eon.boolean(),
            ),
            multi_field=o["multi_field"].one_of(
                # helper equivalent to: lambda v: v.float()
                eon.float(),
                eon.object_of(eon.float()),
            ),
            list_field=o["list_field"].list_of(
                eon.integer(),
            ),
            baz=o["baz"].custom(Baz),
        )

@dataclass
class Baz:
    state: State
    required_nullable: str | None

    @classmethod
    def __decode_eon__(cls, v: eon.Value) -> Baz:
        o = v.object()
        return Baz(
            state=o["state"].custom(State),
            required_nullable=o["required_nullable"].one_of(
                eon.string(),
                eon.null(),
            ),
        )

class State(Enum):
    ON = "ON"
    OFF = "OFF"

    @classmethod
    def __decode_eon__(cls, v: eon.Value) -> State:
        s = v.string()
        try:
            return cls[s.upper()]
        except KeyError:
            raise eon.DecodeError(f"Invalid State: {s}")

def main():
    cfg = eon.loads(s, Config)
    print(cfg)
```

### Typescript/Javascript

```ts
type Config = {
  str_field: string
  optional_bool?: boolean
  multi_field: number | Record<string, number>
  list_field: number[]
  baz: Baz
}

type Baz = {
  state: State
  required_nullable: string | null
}

type State = 'ON' | 'OFF'

const decodeConfig = (v: eon.Value): Config => {
  const o = v.object()
  return {
    str_field: o.str_field.string(),
    optional_bool: o.optional_bool?.boolean(),
    multi_field: o.multi_field.oneOf(
      // helper equivalent to: (v) => v.float()
      eon.float(),
      eon.objectOf(eon.float()),
    ),
    list_field: o.list_field.list_of(eon.integer()),
    baz: o.baz.decodeWith(decodeBaz),
  }
}

const decodeBaz = (v: eon.Value): Baz => {
  const o = v.object()
  return {
    state: o.state.decodeWith(decodeState),
    required_nullable: o.required_nullable.oneOf(
      eon.string(),
      eon.null(),
    ),
  }
}

const decodeState = (v: eon.Value): State => {
  const s = v.string()
  switch (s) {
    case 'ON':
    case 'OFF':
      return s
    default:
      throw new eon.DecodeError(`Invalid State: ${s}`)
  }
}

const main = () => {
  const cfg = eon.parse(s).decodeWith(decodeConfig)
  console.log(cfg)
}
```

### Haskell

```haskell
data Config = Config
  { strField :: Text
  , optionalBool :: Maybe Bool
  , multiField :: Either Double (Map Text Double)
  , listField :: [Int]
  , baz :: Baz
  }
  deriving (Show)

data Baz = Baz
  { state :: State
  , requiredNullable :: Maybe Text
  }
  deriving (Show)

data State = ON | OFF
  deriving (Show)

instance FromEON Config where
  parseEON = parseObject "Config" $
    -- the type to parse a field as is determined
    -- automatically by FromEON instance resolution
    Config
      <$> parseField "str_field"
      <*> parseField "optional_bool"
      <*> parseField "multi_field"
      <*> parseField "list_field"
      <*> parseField "baz"

instance FromEON Baz where
  parseEON = parseObject "Baz" $
    Baz
      <$> parseField "state"
      <*> parseField "required_nullable"

instance FromEON State where
  parseEON = parseText >>= \case
    "ON" -> pure ON
    "OFF" -> pure OFF
    s -> fail $ "Invalid State: " <> show s

main :: IO ()
main = either (error . show) print $ Eon.decode s
```

## Miscellaneous

These are some random musings I have that would be nice to include in the spec, but I'm not tied to them.

* I would probably enforce that lists are indented one more level, e.g.

    ```
    a_list:
      - a
      - b
      - c
    ```

    and disallow

    ```
    a_list:
    - a
    - b
    - c
    ```

    since it annoys me that there are two ways, and two developers editing the same file might be inconsistent with the indentation

* Smart quotes have bitten people before when copy-pasting, would probably want to require smart quotes or apostrophes to be quoted, always

## Comparison to other formats

* **XML** is a bit verbose for me, and very difficult to read. The line between attributes and subnodes are a bit fuzzy, and it's annoying to have to repeat the whole tag name to open and close the node. One thing that XML shares with EON, though, is that it also treats node contents as strings, with type deserialization being defined in the application.
* **JSON** is really good for transferring data between machines, but is not good for user generation + consumption. It doesn't support comments, it doesn't support trailing commas, and, while unambiguous in terms of what things parse to, is relatively hard to read.
* **YAML** is rather nice, but the spec includes way too many features, and has some confusing behaviors. Feature-wise, it supports anchors (making `&` and `*` reserved characters), type-defining pragmas (which led to arbitrary code execution in the initial Python implementation), and automatic value conversions (`[x,y,z]` => `["x", true, "z"]`), which are way too featureful, A. for what I want to support in a config file, and B. for library implementers to be completely spec-compliant.
* **TOML** is really good for flat-ish configs, but if you want to nest lists and objects a few levels, TOML really starts to stretch to its limit.
* Typed configuration languages like **Dhall** or **Nickel** have a lot of syntax, are a bit difficult to learn, and, similar to YAML, is a bit too featureful than I need/want.

Yes, obligatory XKCD:

![XKCD: Standards](https://imgs.xkcd.com/comics/standards.png)

I think all of the above formats are really good for certain things, but I think the one thing currently lacking is a readable format (like YAML) with very simple semantics (unlike YAML). EON fills this gap, and introduces a new concept of a configuration format that doesn't force users to know about types. If you have a field where you really need to allow the user to specify if they mean the number `1` or the string `"1"`, then sure, go with YAML. But I would imagine 90% of the time, the user doesn't need the distinction, which is where EON's simplicity shines over YAML.

# Next steps

What are your thoughts? Would you find this format useful? Vote and/or comment [here](https://github.com/brandonchinn178/brandonchinn178.github.io/discussions/17)!

Huge thanks to Paul Craddick + Greg Lorence for fleshing out some of these thoughts with me.

[^1]: Yes, YAML 1.2 only allows `true` or `false` now, but does your YAML parsing library using 1.2? If your library uses `libyaml`, you're [still on 1.1](https://github.com/yaml/libyaml/issues/20)
[^2]: Actual implementation may avoid the intermediate JSON object for performance reasons. But this is the conceptual model that one should have.
