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

## Configuring the Apps Script data source

Set the Google Apps Script Web App URL that returns JSON as the single data source for the dashboard:

- **Local development (Vite)**: add `VITE_APPS_SCRIPT_URL=...` to your `.env` file.
- **Netlify / serverless functions**: set `APPS_SCRIPT_URL=...` (the server also falls back to `VITE_APPS_SCRIPT_URL`).

Example entry for your environment file:

```
APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycby1wbXX8cW4Z17E4ype83OebSYFYSzP5-Q-XEKhONXzhuADaCLKeiWwg6H7BMzMRm4g/exec
```

Deploy the Apps Script as a Web App with "Anyone with the link" access so the backend can retrieve the JSON payload.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
