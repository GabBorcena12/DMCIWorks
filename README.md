# DMCI Homes Landing Page

Modern real-estate landing page for DMCI Homes property inquiries. The project is built as a Blazor site for local development and also includes a static `/docs` export for GitHub Pages hosting.

## Project Overview

- Premium responsive landing page for DMCI Homes property browsing
- Dynamic property, news, and construction-update sections loaded from JSON
- Property cards with image carousels, filters, show more/show less behavior, and detail modals
- News and site progress modals
- Broker and inquiry sections
- Static Forms inquiry submission for GitHub Pages, with no server-side email credentials
- `/docs/index.html` and `/docs/404.html` for GitHub Pages deployment

## Tech Stack

- .NET / Blazor: `net10.0`
- Static assets: HTML, CSS, JavaScript, JSON
- Hosting target: GitHub Pages using the `/docs` folder
- Form backend: Static Forms

## Main Files

- `DMCIProject/Components/Pages/Home.razor` - main landing page markup
- `DMCIProject/wwwroot/assets/css/styles.css` - site styling and responsive UI
- `DMCIProject/wwwroot/assets/js/main.js` - property rendering, filters, modals, carousels, animations, and inquiry submit logic
- `DMCIProject/wwwroot/data/properties.json` - property listing data
- `DMCIProject/wwwroot/data/news.json` - news/update card data
- `DMCIProject/wwwroot/data/site-progress.json` - construction update data
- `DMCIProject/wwwroot/config/inquiry-config.json` - public Static Forms config
- `docs/` - static GitHub Pages output

## Local Development

Run the Blazor site:

```powershell
dotnet run --project DMCIProject\DMCIProject.csproj
```

Build the project:

```powershell
dotnet build DMCIProject.slnx -v:minimal
```

Default local URL:

```text
http://localhost:5276
```

## Inquiry Form Setup

The inquiry form uses Static Forms because GitHub Pages does not provide a backend server.

The form posts to:

```text
https://api.staticforms.dev/submit
```

The committed source uses this placeholder only:

```text
__STATIC_FORMS_API_KEY__
```

The real API key is injected during GitHub Actions deployment from the `STATIC_FORMS_API_KEY` repository secret. Replace the placeholder only in the temporary deployment artifact, not in committed files.

The hidden `apiKey` input is located here:

```text
DMCIProject/Components/Pages/Home.razor
```

The generated GitHub Pages source copy also contains the same placeholder:

```text
docs/index.html
docs/404.html
```

Keep the source file updated first, then regenerate `/docs` so both versions stay aligned. The workflow copies `/docs` into a temporary `./site` folder and injects the real key there before deploying.

Local-only dummy values are also in:

```text
DMCIProject/Properties/launchSettings.json
```

Do not put Gmail passwords, SMTP credentials, or private secrets in this static site.

## Updating Property Content

Edit property data in:

```text
DMCIProject/wwwroot/data/properties.json
```

Each property can include:

- name
- location and city
- category tags
- price range
- unit types
- status
- image and gallery images
- features and amenities
- inquiry message

Property cards and modals are generated from JSON. Do not hard-code property cards in `Home.razor`.

## GitHub Pages Deployment

This repo includes a static export in `/docs`:

```text
docs/index.html
docs/404.html
docs/assets/
docs/data/
docs/config/
```

To publish:

1. Commit and push the `/docs` folder.
2. Open the GitHub repository settings.
3. Go to `Pages`.
4. Set the source branch.
5. Set the folder to `/docs`.
6. Save and wait for GitHub Pages to publish.

The `/docs/404.html` file is included as a fallback for static hosting.

## Regenerating `/docs`

After changing `Home.razor`, CSS, JavaScript, data, images, or config, update the `/docs` folder so GitHub Pages receives the latest version.

At minimum, sync these from `DMCIProject/wwwroot` into `docs`:

- `assets`
- `data`
- `config`
- `lib`
- `app.css`
- `favicon.png`

The current `/docs/index.html` also embeds JSON fallback data so the page can still show property, news, and progress cards when opened directly from a local `file://` path.

## Notes

- Property image assets may require permission or authorization for public use.
- Property prices, availability, promos, payment terms, images, and construction status should be confirmed before publishing.
- The site disclaimer identifies this as an independent real estate marketing website handled by Juan Dela Cruz, not the official DMCI Homes website.
