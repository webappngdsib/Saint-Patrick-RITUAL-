# Public diary entries

Use **New entry** on [Saint Patrick Diary](https://webappngdsib.github.io/Saint-Patrick-RITUAL-/diary.html). Enter the meeting details, add any photographs, and select **Publish entry**. The first publication in each open tab requires a GitHub token scoped to this repository with Contents read and write permission. The diary keeps the token in memory for that tab. Public entries appear after GitHub Pages deploys.

Each file is a JSON array with one or more records. A record has a `date` (YYYY-MM-DD), `location`, `chamber`, and a `photos` array with up to three image data URLs. The diary can also publish entries previously saved in the current browser.
