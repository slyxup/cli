# Quick Start Guide

Get started with SlyxUp CLI in 5 minutes!

## Installation

Install globally with npm:

```bash
npm install -g @slyxup/cli
```

Verify installation:

```bash
slyxup --version
```

## Create Your First Project

### Step 1: Initialize a React Project

```bash
slyxup init react my-awesome-app
```

This will:
- ✅ Download the React template
- ✅ Verify file integrity
- ✅ Extract files to `my-awesome-app/`
- ✅ Initialize project metadata

### Step 2: Navigate to Your Project

```bash
cd my-awesome-app
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start Development Server

```bash
npm run dev
```

Your app is now running at `http://localhost:5173`! 🎉

## Add Features

### Add Tailwind CSS

```bash
slyxup add tailwind
npm install
```

This will:
- ✅ Add Tailwind configuration files
- ✅ Update `package.json` with dependencies
- ✅ Modify CSS files to include Tailwind directives

### Add shadcn/ui Components

```bash
slyxup add shadcn
npm install
```

### Add Lucide Icons

```bash
slyxup add lucide
npm install
```

## Project Structure

After initialization, your project will look like:

```
my-awesome-app/
├── .slyxup/               # SlyxUp metadata
│   └── project.json       # Project configuration
├── node_modules/
├── public/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Available Commands

### List Available Templates

```bash
slyxup list templates
```

### List Available Features

```bash
slyxup list features
```

### View Cache Info

```bash
slyxup cache info
```

### Clear Cache

```bash
slyxup cache clear
```

## What's Next?

- **Read the full documentation**: Check out [README.md](../README.md)
- **Learn the architecture**: See [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Contribute**: Read [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Join the community**: [Discord](https://discord.gg/slyxup)

## Common Issues

### "Directory already exists"

The target directory already exists. Choose a different name:

```bash
slyxup init react my-app-v2
```

### "Not in a SlyxUp project directory"

Run `slyxup add` from within a project created with `slyxup init`:

```bash
cd my-awesome-app
slyxup add tailwind
```

### "Registry fetch failed"

Check your internet connection and try again:

```bash
slyxup init react my-app
```

## Tips & Tricks

### Use Specific Versions

```bash
# Use specific template version
slyxup init react my-app --version 1.0.0

# Use specific feature version
slyxup add tailwind --version 3.4.0
```

### Skip npm install

```bash
# Add multiple features then install once
slyxup add tailwind --skip-install
slyxup add shadcn --skip-install
slyxup add lucide --skip-install

npm install
```

### Use with npx (No Installation)

```bash
npx @slyxup/cli init react my-app
```

## Next Steps

Now that you have a basic project set up, try:

1. **Customize your template**
   - Edit `src/App.tsx`
   - Modify `tailwind.config.js`
   - Add your own components

2. **Explore features**
   - Try different templates
   - Add more features
   - Create your own features

3. **Build for production**
   ```bash
   npm run build
   ```

4. **Deploy**
   - Vercel: `vercel`
   - Netlify: `netlify deploy`
   - GitHub Pages: Push to `gh-pages` branch

---

Happy coding! 🚀

Need help? [Open an issue](https://github.com/slyxup/cli/issues) or join our [Discord](https://discord.gg/slyxup).
