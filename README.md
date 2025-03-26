# .NET 8 Container Demo App

Basic introduction to containering a .NET 8+ app.

Will cover:

- Creating a sample .NET 8 web app
- Build and test locally
- Containerising with Draft
- Publishing a container image to Azure Container Registry (ACR)
- Deploying to target service (ACA, AKS) - see below
- Next steps

ACA only:
- Deploying from image to Azure Container Apps
- Monitoring, metrics, logging basics

AKS only:
- Creating a Helm Chart
- Publishing a Helm Chart to Azure Container Registry (ACR)
- Deploying from Helm Chart to AKS Automatic
- Monitoring, metrics, logging basics with Azure Monitor (Container Insights and Metrics add-on)

# Pre-requisites

```sh
az extension add --name containerapp --upgrade --allow-preview true
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az login
```

## Deploy Azure Resources for later steps

Only the base resources will be created wth Bicep.  The images and containers will be managed using Azure CLI.

```sh
RG_NAME=demoapp
LOCATION=australiaeast

az group create -n $RG_NAME -l $LOCATION
az deployment group create -g $RG_NAME --template-file ./infra/main.bicep --parameters @./infra/main.parameters.json
```

## Create project and test locally

```sh
dotnet new webapp -n demoapp

cd demoapp/
echo -e "bin/\nobj/\n" > .gitignore
dotnet run
```

## Create Dockerfile and test in Docker Desktop

Download `draft` from: https://github.com/Azure/draft

```sh
draft create --dockerfile-only
# update dotnet version base image tag to 8.0

docker build -t demoapp:1.0.0 .

docker image ls
docker run -d -p 8080:80 demoapp:1.0.0

docker inspect demoapp:1.0.0
```

## Push image to Azure Container Registry

```sh
# Login to the ACR to be able to push images
ACR_NAME="$(az deployment group show -g $RG_NAME -n main --query properties.outputs.azurE_CONTAINER_REGISTRY_NAME.value -o tsv)"
ACR_REGISTRY_SERVER="$(az deployment group show -g $RG_NAME -n main --query properties.outputs.azurE_CONTAINER_REGISTRY_ENDPOINT.value -o tsv)"

az acr login -n $ACR_NAME -g $RG_NAME

# Tag and push imager to ACR
docker tag demoapp:1.0.0 $ACR_REGISTRY_SERVER/demoapp:1.0.0
docker push $ACR_REGISTRY_SERVER/demoapp:1.0.0
```

## ACA: Deploying from image to Azure Container Apps

```sh
AZURE_CONTAINER_ENVIRONMENT_NAME="$(az deployment group show -g $RG_NAME -n main --query properties.outputs.azurE_CONTAINER_ENVIRONMENT_NAME.value -o tsv)"
ACA_IDENTITY_ID="$(az deployment group show -g $RG_NAME -n main --query properties.outputs.acA_IDENTITY_ID.value -o tsv)"

az containerapp create \
    --name my-container-app \
    --resource-group $RG_NAME \
    --environment $AZURE_CONTAINER_ENVIRONMENT_NAME \
    --image $ACR_REGISTRY_SERVER/demoapp:1.0.1 \
    --target-port 80 \
    --ingress external \
    --query properties.configuration.ingress.fqdn \
    --user-assigned $ACA_IDENTITY_ID \
    --registry-identity $ACA_IDENTITY_ID \
    --registry-server $ACR_REGISTRY_SERVER

# or update existing app to use new image version

az containerapp update -n my-container-app -g $RG_NAME \
  --image $ACR_REGISTRY_SERVER/demoapp:1.0.1
```

## ACA: Monitoring, metrics, logging basics

### Console

Connect to console (`/bin/sh`):

```sh
su
# List processes
ls -l /proc/*/exe
for prc in /proc/*/cmdline; { (printf "$prc "; cat -A "$prc") | sed 's/\^@/ /g;s|/proc/||;s|/cmdline||'; echo; }
# List app files
cd /app
ls -al
```

### Debug Console

See [built-in tools](https://learn.microsoft.com/en-us/azure/container-apps/container-debug-console?tabs=bash#built-in-tools-in-debug-console)

```sh
ps -ef
```

### Logs

Select the Container app.

View:
- Log Streaming
- Logs (tables: `ContainerAppSystemLogs_CL`, `ContainerAppConsoleLogs_CL`)

```sh
WORKSPACE_ID="$(az monitor log-analytics workspace list --query [0].customerId -o tsv)"
az monitor log-analytics query \
  --workspace $WORKSPACE_ID \
    --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s contains 'my-container-app' | where TimeGenerated >= ago(30m) | project ContainerAppName_s, Log_s, TimeGenerated | order by TimeGenerated desc | take 20" \
  --out table
```

### Metrics

Select the Container app.

Try:
- Average Response Time (preview), Sum, Last 1 hour
- CPU Usage, Avg, Last 1 hour

### OTel endpoints to Application Insights (Traces and Logs only)

See [Collect and read OpenTelemetry data in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/opentelemetry-agents?tabs=arm%2Carm-example)

See [infra/core/host/container-apps-environment.bicep](infra/core/host/container-apps-environment.bicep) line 23.

## ACA: CI/CD

```sh
SUB_ID="$(az account show --query id -o tsv)"

az ad sp create-for-rbac \
  --name github-actions-demoapp \
  --role "contributor" \
  --scopes /subscriptions/$SUB_ID/resourceGroups/$RG_NAME > azure-credentials.json
```

Create `creds.json` with these fields (using info from `azure-credentials.json`):

```json
{
    "clientSecret":  "******",
    "subscriptionId":  "******",
    "tenantId":  "******",
    "clientId":  "******"
}
```

Add contents of `creds.json` to GitHub Actions Secret `AZURE_CREDENTIALS`.


# AKS only (TODO)

- Create an AKS Automatic Cluster
- Creating a Helm Chart
- Publishing a Helm Chart to Azure Container Registry (ACR)
- Deploying from Helm Chart to AKS Automatic
- Monitoring, metrics, logging basics with Azure Monitor (Container Insights and Metrics add-on)

## Cleanup

```sh
az containerapp delete --name my-container-app --resource-group $RG_NAME

# Delete everything
az group delete -n $RG_NAME
```
