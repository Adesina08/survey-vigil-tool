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

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Connecting to Google Sheets data

The dashboard reads live data from a Google Sheet through a Netlify serverless function. Make sure the following environment
variables are configured in your deployment:

- `GOOGLE_SHEETS_ID` (or `VITE_GOOGLE_SHEETS_ID`)
- `GOOGLE_SHEETS_SUBMISSIONS_SHEET` (or `VITE_GOOGLE_SHEETS_SUBMISSIONS_SHEET`)
- `GOOGLE_SHEETS_DEFAULT_STATE` (or `VITE_GOOGLE_SHEETS_DEFAULT_STATE`)
- `GOOGLE_SHEETS_STATE_TARGETS_SHEET` (or `VITE_GOOGLE_SHEETS_STATE_TARGETS_SHEET`)
- `GOOGLE_SHEETS_STATE_AGE_TARGETS_SHEET` (or `VITE_GOOGLE_SHEETS_STATE_AGE_TARGETS_SHEET`)
- `GOOGLE_SHEETS_STATE_GENDER_TARGETS_SHEET` (or `VITE_GOOGLE_SHEETS_STATE_GENDER_TARGETS_SHEET`)

The serverless function checks for both variable names, so you can keep the `VITE_` prefix used in local development or omit it
when configuring Netlify/production environments.

> **Important:** The Google Visualization API only reads data from published sheets. From Google Sheets, go to
> **File → Share → Publish to web**, publish the document, and ensure anyone with the link can view. Additionally, verify the
> tab names in your sheet match the environment variable values exactly; any mismatch will cause the dashboard to fall back to
> sample data or show "No data available".
