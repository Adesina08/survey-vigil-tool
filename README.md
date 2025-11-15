# Survey Vigil Dashboard

## Project info

This repository contains the OGSTEP Survey dashboard, a Vite + React application for monitoring survey quality metrics.

## How can I edit this code?

You can work on the project locally using any preferred workflow:

1. **Clone the repository**
   ```sh
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```
2. **Install dependencies**
   ```sh
   npm install
   ```
3. **Start the development server**
   ```sh
   npm run dev
   ```

You can also edit files directly on GitHub or within GitHub Codespaces if you prefer a browser-based environment.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Deploy the built assets to your preferred static hosting provider. The default build command is:

```sh
npm run build
```

## Configuring the Google Sheets Data Source

This dashboard loads data directly from a Google Sheet using the Google Visualization API. To configure the data source, create a `.env` file in the root of the project with the following environment variables:

- `VITE_GOOGLE_SHEET_ID`: The ID of the Google Sheet to use as the data source.
- `VITE_GOOGLE_SHEET_NAME`: The name of the sheet (tab) to use within the Google Sheet.
- `VITE_GOOGLE_SHEET_GID` (optional): The numeric sheet identifier (`gid`) from the Google Sheet URL. If provided, it takes precedence over `VITE_GOOGLE_SHEET_NAME`.

See the `.env.example` file for the format.

### Troubleshooting

**How to get the Google Sheet ID and Name:**

1. Open your Google Sheet in the browser.
2. The URL will look something like this: `https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit#gid=123456789`
3. The **Sheet ID** is the long string of characters between `/d/` and `/edit`. In the example above, it's `1aBcDeFgHiJkLmNoPqRsTuVwXyZ`.
4. The **Sheet Name** is the name of the tab at the bottom of the page. If you haven't renamed it, it's probably "Form Responses 1". Alternatively, you can copy the numeric `gid` value from the sheet URL (the part after `gid=`) and set it as `VITE_GOOGLE_SHEET_GID`.

**"Failed to fetch Google Sheet" error:**

If you see an error message in the dashboard that says "Failed to fetch Google Sheet," check the following:

- Ensure the `VITE_GOOGLE_SHEET_ID` or `VITE_GOOGLE_SHEET_NAME` in your `.env` file is correct.
- Verify that the Google Sheet is publicly accessible. Click the "Share" button in the top right of the Google Sheet, and in the "General access" section, select "Anyone with the link".

## Custom domains

When deploying to a hosting provider, follow their documentation for configuring custom domains.
