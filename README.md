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

## Configuring the Google Sheets data source

Set a single environment variable that points to the published GViz URL for your Google Sheet:

- **Local development (Vite)**: add `VITE_GOOGLE_SHEETS_URL=...` to your `.env` file.
- **Netlify / serverless functions**: set `GOOGLE_SHEETS_URL=...` (the functions also fall back to `VITE_GOOGLE_SHEETS_URL`).

Use the exact GViz endpoint (for example `https://docs.google.com/spreadsheets/d/<id>/gviz/tq?sheet=Sheet1`) and ensure the sheet is public or published so the API endpoints can read it.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
