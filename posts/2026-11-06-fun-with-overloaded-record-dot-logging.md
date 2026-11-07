---
title: "Fun with OverloadedRecordDot: Logging"
---

I like `-XOverloadedRecordDot`. There, I said it. It's a controversial extension, and can produce obscure errors, but the ergonomics of having type-namespaced operations instead of global-namespaced or qualified-module-namespaced operations is too compelling for me.

One way I've started using record dots more is with logging:

```hs
module MyApp.Logging (
  Logger (..),
  LogLevel (..),
  stdoutLogger,
) where

import Control.Monad.IO.Class (MonadIO)
import Data.Text (Text)
import Data.Text qualified as Text
import GHC.Records (HasField (..))
import Prelude hiding (log)

newtype Logger m = Logger (LogLevel -> Text -> m ())

data LogLevel
  = LevelDebug
  | LevelInfo
  | LevelWarn
  | LevelError
  deriving (Show, Eq)

instance HasField "render" LogLevel Text where
  render = \case
    LevelDebug -> "DEBUG"
    LevelInfo -> "INFO"
    LevelWarn -> "WARN"
    LevelError -> "ERROR"

instance HasField "debug" (Logger m) (Text -> m ()) where
  getField (Logger log) = log LevelDebug
instance HasField "info" (Logger m) (Text -> m ()) where
  getField (Logger log) = log LevelInfo
instance HasField "warn" (Logger m) (Text -> m ()) where
  getField (Logger log) = log LevelWarn
instance HasField "error" (Logger m) (Text -> m ()) where
  getField (Logger log) = log LevelError

stdoutLogger :: MonadIO m => Logger m
stdoutLogger = Logger $ \level message -> do
  putStrLn $ "[" <> Text.unpack level.render <> "] " <> message
```

In user code:

```hs
myFunc :: Logger IO -> IO ()
myFunc logger = do
  logger.debug "this is a debug message"
  logger.info "this is an info message"

  -- Compare with a slightly more verbose:
  Logging.debug logger "this is a debug message"
  Logging.info logger "this is an info message"

  -- Or polluting the global namespace:
  logDebug logger "this is a debug message"
  logInfo logger "this is an info message"
```

Going further, let's say I want to embed `Logger` into a custom monad. I could do:

```hs
newtype MyMonad a = MyMonad (ReaderT (Logger IO) IO a)

getLogger :: MyMonad (Logger IO)
getLogger = ask
```

```hs
myFunc :: MyMonad ()
myFunc = do
  logger <- getLogger
  liftIO $ logger.debug "this is a debug message"
  liftIO $ logger.info "this is an info message"
```

But we could also define `HasField` instances on monadic values directly!

```hs
logger :: MyMonad (Logger IO)
logger = ask

instance HasField "debug" (MyMonad (Logger IO)) (Text -> MyMonad ()) where
  getField = getLogFunc (.debug)
instance HasField "info" (MyMonad (Logger IO)) (Text -> MyMonad ()) where
  getField = getLogFunc (.info)
instance HasField "warn" (MyMonad (Logger IO)) (Text -> MyMonad ()) where
  getField = getLogFunc (.warn)
instance HasField "error" (MyMonad (Logger IO)) (Text -> MyMonad ()) where
  getField = getLogFunc (.error)

getLogFunc :: (Logger IO -> Text -> IO a) -> MyMonad (Logger IO) -> Text -> MyMonad a
getLogFunc f getLogger message = do
  l <- getLogger
  liftIO $ f l message
```

```hs
myFunc :: MyMonad ()
myFunc = do
  logger.debug "this is a debug message"
  logger.info "this is an info message"
```
