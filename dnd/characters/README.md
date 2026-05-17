# Adding a character

1. Drop the character's JSON file in this directory. Filename must match the `id` field inside, e.g. `bob-knight-tavern.json` for `"id": "bob-knight-tavern"`.
2. From the repo root, run:
   ```sh
   node dnd/scripts/build-dnd-index.js
   ```
   This regenerates `index.json` (used by the browse page) and creates `/dnd/<id>.html` if it doesn't exist.
3. Commit and push.

The browse page at `/dnd/` will pick up the new character automatically. The sheet itself loads at `/dnd/<id>.html`.

## Removing a character

Delete the JSON, run the build script, delete the now-orphan `/dnd/<id>.html` shim (the script warns about orphans), commit.
