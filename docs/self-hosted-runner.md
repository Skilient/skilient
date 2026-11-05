# Self-hosted runner

The organisation's GitHub-hosted Actions minutes are used up until the cycle resets, and the budget stays at $0
(decisions 2026-11-05). Jobs on a self-hosted runner are free, so the two manual workflows that need long runs,
**Restore drill** and **Load test**, run on Ahmed's own Linux machine. CI on pull requests still uses GitHub's
runners.

Both workflows ask for `runs-on: [self-hosted, linux, skilient]`, so only a runner with the `skilient` label picks
them up. They are started by hand (`workflow_dispatch`).

**The repository is public** (2026-11-05), so a workflow in someone else's pull request could ask for this runner. Keep
Settings → Actions → General → **Fork pull request workflows from outside collaborators** on **Require approval for all
outside collaborators**, approve nothing from people you don't know, and stop `run.sh` when you're not running a drill or
a load test.

## What the machine needs

- Linux x64, online and awake for the whole run (drill about 15–30 minutes from Pakistan; load test about an hour).
- **Docker**, usable by your user without `sudo`: `supabase db dump` runs PostgreSQL 17 in a container.
- **PostgreSQL client** (`psql`) 17, or 16.10 or newer. Dumps from `pg_dump` 17 can contain `\restrict` lines that
  older `psql` builds don't understand.
- `git`, `curl`, `tar`. Node 22 and pnpm are installed by the workflows themselves.
- Port **3100** free while the drill runs (it starts the app there to check `/api/health`).

On Ubuntu or Debian:

```bash
sudo apt-get update && sudo apt-get install -y git curl tar ca-certificates postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt-get install -y postgresql-client-17
```

Docker: install Docker Engine (docs.docker.com/engine/install), then let your user run it and log out and in again:

```bash
sudo usermod -aG docker "$USER"
```

Check: `docker run --rm hello-world` and `psql --version` (17.x, or 16.10 or newer) both work without `sudo`.

On **Fedora** (Ahmed's machine, Fedora 42): Fedora's own `psql` (16.13 there; anything from 16.10 or 17 up reads
`\restrict` lines; the PostgreSQL project's repository has no Fedora 42 build), and Docker from Docker's repository
(Fedora ships Podman, and the Supabase CLI expects Docker):

```bash
sudo dnf install -y git curl tar dnf-plugins-core postgresql
```
```bash
sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo
```
```bash
sudo dnf install -y docker-ce docker-ce-cli containerd.io && sudo systemctl enable --now docker && sudo usermod -aG docker "$USER"
```

Log out and in again, then check as above. On Fedora, start the runner with `./run.sh` in a terminal: SELinux
usually stops the systemd service from running the runner out of a home folder. The runner's own libraries:
`sudo ./bin/installdependencies.sh` in the runner folder.

## Register the runner

1. GitHub → **Skilient/skilient** → **Settings → Actions → Runners → New self-hosted runner** → **Linux**, **x64**.
2. Run the **Download** commands it shows, in a folder such as `~/actions-runner`.
3. Run its **Configure** command, adding the label: append `--labels skilient` to the `./config.sh --url … --token …`
   line. Accept the defaults for the group, the name and the work folder.
4. Start it. Either in a terminal you leave open:

   ```bash
   ./run.sh
   ```

   or as a service that survives reboots:

   ```bash
   sudo ./svc.sh install "$USER"
   ```
   ```bash
   sudo ./svc.sh start
   ```

5. The runner shows as **Idle** under Settings → Actions → Runners with the labels `self-hosted`, `Linux`, `X64`,
   `skilient`.

## Afterwards

Leave it registered while phase 13's drill and load test run. To remove it: `sudo ./svc.sh stop`,
`sudo ./svc.sh uninstall`, then `./config.sh remove --token …` with the token from the runner's page.
After the minutes reset (or if the budget is ever raised), the two workflows can go back to `ubuntu-latest`.
