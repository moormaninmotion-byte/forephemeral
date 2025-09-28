# forephemeral

Note: This repository previously referenced `tool` as a submodule but the `.gitmodules` entry was missing.
I added a minimal `.gitmodules` file linking `tool` to the repository's remote so Git can resolve the path. If you still see submodule errors locally, run:

```
git submodule sync --recursive
git submodule update --init --recursive
```

If `tool` should not be a submodule and instead should be tracked directly, remove the `.git` directory inside `tool/` and commit the folder normally.