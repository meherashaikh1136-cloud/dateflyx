# Dateflyx – Cafe & Date Experience Booking (Pune)

A small web app to **discover** cafes/experiences (search + filters) and **book** a table. After booking, the user sees a
success screen and gets a **confirmation email** automatically.

**Features:** 1) search/filter/save places  2) sign up / log in, book a table at any cafe, see & cancel bookings from the card or your profile, with automatic confirmation and cancellation emails (`POST /api/bookings`, `POST /api/bookings/cancel`).
Accounts and bookings are stored in the user's browser (localStorage); the server only sends emails, so it stays stateless and works with multiple pods.
Stack: Node.js + Express, Nodemailer, Docker, GitHub Actions, Amazon ECR, kind (Kubernetes), Argo CD.

## Run locally
```bash
npm ci
npm test
npm start            # http://localhost:3000
```
Without SMTP settings, emails are only logged to the console. To send real emails set (Gmail example – use an *App Password*):
```bash
SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=you@gmail.com SMTP_PASS=app-password npm start
```

## Docker
```bash
docker build -t dateflyx .
docker run -p 3000:3000 dateflyx
```

## Architecture
Developer → GitHub → GitHub Actions (test, build) → Amazon ECR → manifest updated in Git (`k8s/deployment.yaml`) → Argo CD → kind cluster on EC2 → running app

## One-time setup on the EC2 (Ubuntu) instance
1. Install **docker, aws cli, kubectl, kind** (`kind` = Kubernetes-in-Docker, replaces EKS).
2. Create cluster: `kind create cluster --name dateflyx --config kind-config.yaml`
3. Open **TCP 30080** (app) in the EC2 security group.
4. Create the ECR repo: `aws ecr create-repository --repository-name dateflyx --region ap-south-1`
5. Install Argo CD:
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   kubectl -n argocd port-forward svc/argocd-server 8080:443 --address 0.0.0.0
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d   # admin password
   ```
6. **GitHub OIDC → AWS:** in IAM add the identity provider `token.actions.githubusercontent.com`, create a role trusted for
   `repo:YOUR_USER/dateflyx:ref:refs/heads/main` with ECR push permissions, and save its ARN in the repo secret `AWS_ROLE_ARN`.
   (No long-lived access keys are stored.)
7. Edit `k8s/deployment.yaml` (account id) and `argocd/application.yaml` (repo URL), push to GitHub.
8. Let kind pull from ECR (the kind node has no AWS identity, so give it a pull secret; the token lasts 12 h – re-run before demo):
   ```bash
   kubectl create namespace dateflyx
   kubectl -n dateflyx create secret docker-registry ecr-secret \
     --docker-server=ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com --docker-username=AWS \
     --docker-password="$(aws ecr get-login-password --region ap-south-1)"
   ```
9. Email credentials as a Kubernetes Secret (not in Git):
   ```bash
   kubectl -n dateflyx create secret generic dateflyx-mail \
     --from-literal=SMTP_HOST=smtp.gmail.com --from-literal=SMTP_PORT=587 \
     --from-literal=SMTP_USER=you@gmail.com --from-literal=SMTP_PASS=app-password
   ```
10. Register the app in Argo CD: `kubectl apply -f argocd/application.yaml`

App URL: `http://<EC2-PUBLIC-IP>:30080`

## Demo flow
1. `kubectl get pods -n dateflyx` and Argo CD UI show **Synced / Healthy**.
2. Change something (e.g. hero heading in `public/index.html`) → `git push`.
3. GitHub Actions: tests → build → push to ECR → commits new image tag to `k8s/deployment.yaml`.
4. Argo CD detects the commit, syncs automatically, pods roll out, refresh the page to see the change.
5. GitOps proof: change `replicas: 2` → `3` in Git and watch Argo CD scale it.
