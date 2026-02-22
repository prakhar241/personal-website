# =============================================
# Infrastructure Deployment Script
# Usage: .\deploy.ps1 -Environment preprod
# =============================================

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("preprod", "prod")]
    [string]$Environment,

    [string]$Location = "eastus",
    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId
)

$ErrorActionPreference = "Stop"

$resourceGroupName = "rg-blog-$Environment"
$parametersFile = "./parameters/$Environment.parameters.json"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying Blog Infrastructure" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "Resource Group: $resourceGroupName" -ForegroundColor Cyan
Write-Host "Location: $Location" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Set subscription
Write-Host "`nSetting subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId

# Create resource group
Write-Host "`nCreating resource group..." -ForegroundColor Yellow
az group create `
    --name $resourceGroupName `
    --location $Location `
    --tags project=personal-blog environment=$Environment managedBy=bicep

# Deploy Bicep template
Write-Host "`nDeploying Bicep template..." -ForegroundColor Yellow
$deployment = az deployment group create `
    --resource-group $resourceGroupName `
    --template-file ./main.bicep `
    --parameters "@$parametersFile" `
    --name "blog-$Environment-$(Get-Date -Format 'yyyyMMddHHmm')" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Deployment Successful!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Output important values
$outputs = $deployment.properties.outputs
Write-Host "`nAKS Cluster: $($outputs.aksClusterName.value)" -ForegroundColor White
Write-Host "ACR Login Server: $($outputs.acrLoginServer.value)" -ForegroundColor White
Write-Host "Key Vault: $($outputs.keyVaultName.value)" -ForegroundColor White
Write-Host "PostgreSQL FQDN: $($outputs.postgresqlFqdn.value)" -ForegroundColor White

# Get AKS credentials
Write-Host "`nGetting AKS credentials..." -ForegroundColor Yellow
az aks get-credentials `
    --resource-group $resourceGroupName `
    --name $outputs.aksClusterName.value `
    --overwrite-existing

Write-Host "`nDone! You can now deploy to AKS with kubectl." -ForegroundColor Green
