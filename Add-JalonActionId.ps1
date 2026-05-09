#Requires -Version 5.1
<#
.SYNOPSIS
    Ajoute la colonne ActionId (texte) dans la liste Jalons.
    Cette colonne remplace Axe et stocke l'ID SharePoint de l'objectif associé.
#>

$SITE_URL      = "https://munstukelysud.sharepoint.com/sites/Doc_Public"
$PNP_CLIENT_ID = "f21b9923-650b-413c-8ebf-1ec8bcd02658"
$LISTE         = "Jalons"

Write-Host "`nConnexion à SharePoint..." -ForegroundColor Cyan
Connect-PnPOnline -Url $SITE_URL -Interactive -ClientId $PNP_CLIENT_ID

# Vérifier si la colonne ActionId existe déjà
$existing = Get-PnPField -List $LISTE -Identity "ActionId" -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host "La colonne ActionId existe déjà." -ForegroundColor Yellow
} else {
    Add-PnPField -List $LISTE -DisplayName "ActionId" -InternalName "ActionId" `
        -Type Text -AddToDefaultView $false
    Write-Host "Colonne ActionId ajoutée avec succès." -ForegroundColor Green
}

# Rendre la colonne Axe optionnelle (compatibilité ascendante)
$axeField = Get-PnPField -List $LISTE -Identity "Axe" -ErrorAction SilentlyContinue
if ($axeField -and $axeField.Required) {
    Set-PnPField -List $LISTE -Identity "Axe" -Values @{ Required = $false }
    Write-Host "Colonne Axe rendue optionnelle." -ForegroundColor Green
}

Write-Host "`nTerminé." -ForegroundColor Green
Disconnect-PnPOnline
