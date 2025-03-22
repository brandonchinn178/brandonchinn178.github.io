---
title: "Automating Fourmolu releases with GitHub Actions"
---

One of my very first PRs into Fourmolu was setting up CI. Initially, I used Circle CI, as it's what I've used in all my other open source repos, and Matt Parsons initially expressed a slight preference to it over GitHub Actions. But as I've gotten more familiar with GitHub Actions, and also as I've been trying to figure out how to automate GitHub releases, it seems like the tighter out-of-the-box integration between the CI and GitHub makes our lives a bit easier.

Specifically, I wanted the release process to be kicked off manually (instead of doing something like checking to see if the version changed in the `.cabal` file in the last PR). GitHub Actions provides a `workflow_dispatch` trigger that can be started by going to the repo's GitHub Actions + clicking "Run workflow". There are also other niceties here, like the workflow automatically generating a GitHub token to use.

# Reimplementing CI with GitHub Actions

Commit: [`e28d8fcc736c8421635a24d6a2290718e2396a71`](https://github.com/fourmolu/fourmolu/pull/183/commits/e28d8fcc736c8421635a24d6a2290718e2396a71)

The first thing I did was basically move `.circleci/config.yml` verbatim into `.github/workflows/ci.yml`. However, I also took the opportunity to refactor the jobs a bit. Specifically, previously there was one Circle CI job that did everything:

```
run_job(stack_yaml, latest):
    build()
    if latest: lint()
    test()
    if latest: haddock()
    if latest: sdist()

in_parallel(
    run_job(stack.yaml, latest=true)
    run_job(stack-ghc-8.10.yaml, latest=false)
    run_job(stack-ghc-9.0.yaml, latest=false)
    run_job(stack-ghc-9.2.yaml, latest=false)
)
```

This interleaving was useful to reuse the build artifacts, but it also means that if one thing fails (e.g. linting), it won't run anything afterwards (e.g. tests). It's also a bit annoying that 60% of the job is only relevant to one run type.

So when I moved to GitHub Actions, I also took the opportunity to break up the one job into separate, independent jobs, as well as add MacOS to the build matrix. To reiterate, all this could've been done in Circle CI too (there's nothing specific to GitHub Actions), but we just didn't have any need to.

I also added a new `build_prod` job that uses production settings (e.g. turns on the `fixity-th` flag, which is disabled in development to speed up compile times) and renames the binaries with platform information (e.g. `fourmolu-0.6.0.0-linux-x86_64`) using a quick `GetBuildInfo.hs` script that reads the version from the Cabal file and gets the platform information from `Distribution.System`.

So now, CI works as:
```
in_parallel(
    build_and_test(stack.yaml, linux)
    build_and_test(stack.yaml, osx)
    build_and_test(stack-ghc-8.10.yaml, linux)
    build_and_test(stack-ghc-8.10.yaml, osx)
    ...
    build_prod(linux)
    build_prod(osx)
    lint()
    haddock()
    sdist()
)
```

# Automate GitHub release

Commit: [`65abc15d3aed3b0b6aff0663a3200ca42effa293`](https://github.com/fourmolu/fourmolu/pull/183/commits/65abc15d3aed3b0b6aff0663a3200ca42effa293)

After the switch-over, I was able to implement `.github/workflows/release.yml` triggered by `workflow_dispatch`. First, I used the [`workflow_call`](https://docs.github.com/en/actions/using-workflows/reusing-workflows) feature to run the usual CI workflow as part of the Release workflow, so that we make extra sure the code passes CI before releasing.

Then I wrote a Python script to create a GitHub release with:
* The version parsed from the cabal file
* The changes in the `CHANGELOG` for this version
* The production binaries for Linux + Mac ([#159](https://github.com/fourmolu/fourmolu/issues/159))

This was previously all done manually every release, and this is going to make releases super easy to do!

## Python?? In my Haskell codebase??

So originally, I was writing the release script in Haskell using `stack script`. But the script required the use of at least `aeson`, `http-client`, `http-client-tls`, and `directory`, and the cache wasn't helping (because I hadn't had a successful run yet), which made it slow to build while iterating (since I had to rebuild the dependencies each time).

Python just made my life so much easier, especially with JSON, filepath, and logging support provided out of the box, with [`requests`](https://docs.python-requests.org/en/latest/) being the one third-party library. I added [`pyright`](https://github.com/microsoft/pyright#readme) and [`black`](https://github.com/psf/black) as linters, which adds static type checking and auto-formatting, respectively, to the Python code, so there's still a degree of confidence in correctness.

It's just _so_ nice:

```hs
manager <- newTlsManager
createReqInit <- parseUrlThrow $ "POST https://api.github.com/repos/" ++ repo ++ "/releases"
let createReq =
      createReqInit
        { requestHeaders =
            [ (hAccept, "application/vnd.github.v3+json"),
              (hAuthorization, "token " <> Char8.pack token),
              (hContentType, "application/json"),
              (hUserAgent, Char8.pack repo)
            ],
          requestBody =
            RequestBodyLBS . Aeson.encode . Aeson.object $
              [ "tag_name" .= versionName,
                "target_commitish" .= sha,
                "name" .= versionName,
                "body" .= versionChanges
              ]
        }

createResp <- httpLbs createReq manager
CreateResponse{uploadUrl} <- either fail return . Aeson.eitherDecode . responseBody $ createResp

instance Aeson.FromJSON CreateResponse where
  parseJSON = Aeson.withObject "CreateResponse" $ \o ->
    CreateResponse <$> o .: "upload_url"
```

```py
session = requests.Session()
create_resp = requests.post(
    f"https://api.github.com/repos/{repo}/releases",
    headers={
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {token}",
        "Content-Type": "application/json",
        "User-Agent": repo,
    },
    json={
        "tag_name": version_name,
        "target_commitish": sha,
        "name": version_name,
        "body": version_changes,
    },
)
create_resp.raise_for_status()
upload_url = create_resp.json()["upload_url"]
```

This brought my iteration time from [15 minutes](https://github.com/fourmolu/fourmolu/runs/6494894257) to [10 seconds](https://github.com/fourmolu/fourmolu/runs/6500643847).

# Automate Hackage release

Commit: [`8aeac3058a7f3da8df1eadf142a15ab97ba623a5`](https://github.com/fourmolu/fourmolu/pull/183/commits/8aeac3058a7f3da8df1eadf142a15ab97ba623a5)

Finally, as one last nice-to-have, I added automatic release to Hackage (as a package candidate) in the workflow. The biggest concern here was, whose token to use to upload to Hackage, but I figured out how to make it such that it would use the Hackage token of the GitHub user who started the run! So a maintainer would just need to add a new "Secret" to the repository named `HACKAGE_TOKEN_<github username>`, and the GitHub action will dynamically select the token to use:

{% raw %}
```yaml
- name: Load Hackage token secret name
  run: |
    import re
    username = "${{ github.actor }}"
    secret_name = "HACKAGE_TOKEN_" + re.sub(r"\W+", "_", username).upper()
    print(f"::set-output name=secret_name::{secret_name}")
  shell: python
  id: hackage_token_secret

- name: Make release
  run: scripts/make-release.sh
  env:
    hackage_token: ${{ secrets[steps.hackage_token_secret.outputs.secret_name] }}
    ...
```
{% endraw %}

It turned out to be a rather simple implementation with `requests`:

```py
with sdist_archive.open("rb") as f:
    session.post(
        "https://hackage.haskell.org/packages/candidates",
        headers={"Authorization": f"X-ApiKey {token}"},
        files={"package": f},
    )
```

# Conclusion

Overall, I'm really happy with this implementation. Of course, we'll see how it runs when we release Fourmolu for the first time with this workflow, but if my testing was any indication, it should be a really pain-free process.
