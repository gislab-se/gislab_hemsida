# Project data

`projects.json` is a project inventory and can still be useful as source material.
The public homepage now renders its key examples directly in HTML so search
engines can read them without JavaScript.

To change the homepage project cards, edit `index.html` and `en/index.html`.

## Structure

- `email.user`: local part of the contact email address.
- `email.domain`: domain part of the contact email address.
- `projects[]`: list of project objects.

Each project object has:

- `url`
- `title.sv` and `title.en`
- `description.sv` and `description.en`

After changes, commit and push to `main` and GitHub Pages will publish automatically.
