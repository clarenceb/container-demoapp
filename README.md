# .NET 8 Container Demo App

Basic introduction to containering a .NET 8+ app.

Will cover:

- Creating a sample .NET 8 web app
- Build and test locally
- Containerising with Draft
- Publishing a container image to Azure Container Registry (ACR)
- Deploying to target service (ACA, AKS)
- Next steps

ACA only:
- Deploying from code to Azure Container Apps
- Deploying from image to Azure Container Apps
- Monitoring, metrics, logging basics

AKS only:
- Creating a Helm Chart
- Publishing a Helm Chart to Azure Container Registry (ACR)
- Deploying from Helm Chart to AKS Automatic
- Monitoring, metrics, logging basics with Azure Monitor (Container Insights and Metrics add-on)

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

## Create an Azure Container Apps Environment

## Create an AKS Automatic Cluster

## Push image to Azure Container Registry

```sh
# Setup
az group create -n mydemoapp -l australiaeast
az acr create -n demoappcbxacr -g mydemoapp --sku Standard
az acr login -n demoappcbxacr -g mydemoapp

# Tag and push imager to ACR
docker tag demoapp:1.0.0 demoappcbxacr.azurecr.io/demoapp:1.0.0
docker push demoappcbxacr.azurecr.io/demoapp:1.0.0
```

## Deploy app to Container Apps

```sh
# Setup - managed identity foir ACR, Log Analytics for logs and metrics
LA_CUSTOMER_ID=$(az monitor log-analytics workspace create --name mydemoapplwcbx --resource-group mydemoapp --query customerId -o tsv)
az containerapp env create --name mycontainerappenv --resource-group mydemoapp --location australiaeast --logs-destination log-analytics --logs-workspace-id $LA_CUSTOMER_ID
IDENTITY="demoappacr-umi"
az identity create --name $IDENTITY --resource-group mydemoapp
IDENTITY_CLIENT_ID=$(az identity show -n $IDENTITY -g mydemoapp --query clientId -o tsv)
IDENTITY_RESOURCE_ID=$(az identity show -n $IDENTITY -g mydemoapp --query id -o tsv)
ACR_RESOURCE_ID=$(az acr show -n demoappcbxacr -g mydemoapp --query id -o tsv)
az role assignment create --role "AcrPull" --assignee $IDENTITY_CLIENT_ID --scope $ACR_RESOURCE_ID

# Deploy the container to Azure Container Apps
az containerapp create \
    --name my-container-app \
    --resource-group mydemoapp \
    --environment mycontainerappenv \
    --image demoappcbxacr.azurecr.io/demoapp:1.0.0 \
    --target-port 80 \
    --ingress external \
    --query properties.configuration.ingress.fqdn \
    --user-assigned $IDENTITY_RESOURCE_ID \
    --registry-identity $IDENTITY_RESOURCE_ID \
    --registry-server demoappcbxacr.azurecr.io
```

Examine container apps env and container app in the Azure Portal.

## Deploy app to Azure Kubernetes Service

```sh
# Switch to AKS cluster
kubectl ctx aks-frankbuzzard56
kubectl get node -o wide

# Setup
az aks update -n aks-frankbuzzard56 -g rg-aks-store-demo --attach-acr demoappcbxacr

# Demo demo app
draft create
kubectl create ns demoapp
kubectl label namespace demoapp istio.io/rev=asm-1-23
# Change service from LoabBalancer to ClusterIP
cp ../manifests-backup/manifests-backup/gateways-istio.yaml manifests/
kubectl apply -f manifests/
```

Examine AKS cluster in the Azure Portal.

## Cleanup

```sh
kubectl delete ns demoapp

az containerapp delete --name my-container-app --resource-group mydemoapp
```

## Other Demos

* ARO - ARO Pet Store Demo

```sh
oc login https://api.tm7msl4ly3768bc802.australiaeast.aroapp.io:6443/ -u kubeadmin -p $(az aro list-credentials -g aro-demos -n arodemoscbx | jq -r ".kubeadminPassword")

oc get route -A | grep store
```
