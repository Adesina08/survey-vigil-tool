# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/e281e3e3-daa2-46dd-b066-99dee0aa1b39

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e281e3e3-daa2-46dd-b066-99dee0aa1b39) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e281e3e3-daa2-46dd-b066-99dee0aa1b39) and click on Share -> Publish.

## Configuring the Google Sheets Data Source

This dashboard now loads data directly from a Google Sheet using the Google Visualization API. To configure the data source, you'll need to create a `.env` file in the root of the project and add the following environment variables:

- `VITE_GOOGLE_SHEET_ID`: The ID of the Google Sheet to use as the data source.
- `VITE_GOOGLE_SHEET_NAME`: The name of the sheet (tab) to use within the Google Sheet.

See the `.env.example` file for the format.

### Troubleshooting

**How to get the Google Sheet ID and Name:**

1.  Open your Google Sheet in the browser.
2.  The URL will look something like this: `https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit#gid=123456789`
3.  The **Sheet ID** is the long string of characters between `/d/` and `/edit`. In the example above, it's `1aBcDeFgHiJkLmNoPqRsTuVwXyZ`.
4.  The **Sheet Name** is the name of the tab at the bottom of the page. If you haven't renamed it, it's probably "Form Responses 1".

**"Failed to fetch Google Sheet" error:**

If you see an error message in the dashboard that says "Failed to fetch Google Sheet," it's likely due to one of the following reasons:

- The `VITE_GOOGLE_SHEET_ID` or `VITE_GOOGLE_SHEET_NAME` in your `.env` file is incorrect.
- The Google Sheet is not publicly accessible. To fix this, click the "Share" button in the top right of the Google Sheet, and in the "General access" section, select "Anyone with the link."

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
