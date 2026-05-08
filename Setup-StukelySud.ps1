#Requires -Version 5.1
<#
.SYNOPSIS
    Création des listes SharePoint pour le tableau de bord stratégique — Stukely-Sud

.DESCRIPTION
    Crée les 4 listes SharePoint (Axes_Strategiques, Actions_Plan, Jalons, Historique_Actions)
    avec toutes les colonnes requises par le tableau de bord.
    Aucune donnée de démonstration n'est insérée.

.EXAMPLE
    .\Setup-StukelySud.ps1

.NOTES
    Prérequis : Module PnP.PowerShell
    Installation : Install-Module PnP.PowerShell -Scope CurrentUser -Force
#>

# ============================================================
# CONFIGURATION — STUKELY-SUD
# ============================================================
$SITE_URL     = "https://munstukelysud.sharepoint.com/sites/Doc_Public"
$ADMIN_EMAIL  = "jm.beaupre@muni-consul.ca"   # <-- modifier si besoin

$CONFIG = @{
    ListeActions     = "Actions_Plan"
    ListeAxes        = "Axes_Strategiques"
    ListeJalons      = "Jalons"
    ListeHistorique  = "Historique_Actions"
    ListeConfig      = "Configuration"
}

# ============================================================
# UTILITAIRES
# ============================================================
function Write-Step { param([string]$M) Write-Host "`n>  $M" -ForegroundColor Cyan }
function Write-OK   { param([string]$M) Write-Host "   OK  $M" -ForegroundColor Green }
function Write-Skip { param([string]$M) Write-Host "   --  $M (deja existant)" -ForegroundColor Yellow }
function Write-Fail { param([string]$M, [string]$D="") Write-Host "   !!  $M" -ForegroundColor Red; if($D){ Write-Host "       $D" -ForegroundColor DarkRed } }

function Test-ListeExiste {
    param([string]$N)
    try { return ($null -ne (Get-PnPList -Identity $N -ErrorAction SilentlyContinue)) }
    catch { return $false }
}

function Test-ColonneExiste {
    param([string]$L, [string]$N)
    try { return ($null -ne (Get-PnPField -List $L -Identity $N -ErrorAction SilentlyContinue)) }
    catch { return $false }
}

function Add-Colonne {
    param(
        [string]$Liste,
        [string]$Nom,
        [string]$DisplayName,
        [string]$Type,
        [string[]]$Choices = @(),
        [bool]$Required = $false,
        [bool]$AddToView = $true,
        [string]$Default = ""
    )
    if (Test-ColonneExiste -L $Liste -N $Nom) {
        Write-Skip "Colonne '$DisplayName'"
        return
    }
    try {
        switch ($Type) {
            "Text"     { Add-PnPField -List $Liste -InternalName $Nom -DisplayName $DisplayName -Type Text     -AddToDefaultView:$AddToView | Out-Null }
            "Note"     { Add-PnPField -List $Liste -InternalName $Nom -DisplayName $DisplayName -Type Note     -AddToDefaultView:$false     | Out-Null }
            "Number"   { Add-PnPField -List $Liste -InternalName $Nom -DisplayName $DisplayName -Type Number   -AddToDefaultView:$AddToView | Out-Null }
            "DateTime" { Add-PnPField -List $Liste -InternalName $Nom -DisplayName $DisplayName -Type DateTime -AddToDefaultView:$AddToView | Out-Null }
            "User"     { Add-PnPField -List $Liste -InternalName $Nom -DisplayName $DisplayName -Type User     -AddToDefaultView:$AddToView | Out-Null }
            "Choice"   { Add-PnPField -List $Liste -InternalName $Nom -DisplayName $DisplayName -Type Choice   -Choices $Choices -AddToDefaultView:$AddToView | Out-Null }
            "Currency" { Add-PnPField -List $Liste -InternalName $Nom -DisplayName $DisplayName -Type Currency -AddToDefaultView:$false     | Out-Null }
        }
        if ($Required) {
            Set-PnPField -List $Liste -Identity $Nom -Values @{ Required = $true } | Out-Null
        }
        if ($Default -ne "") {
            Set-PnPField -List $Liste -Identity $Nom -Values @{ DefaultValue = $Default } | Out-Null
        }
        Write-OK "Colonne '$DisplayName'"
    }
    catch { Write-Fail "Colonne '$DisplayName'" $_.Exception.Message }
}

# ============================================================
# ENTÊTE
# ============================================================
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Tableau de bord strategique — Stukely-Sud"     -ForegroundColor Cyan
Write-Host "  Site : $SITE_URL"                               -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# ============================================================
# VÉRIFICATION PRÉREQUIS
# ============================================================
Write-Step "Verification du module PnP.PowerShell"
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "  Module PnP.PowerShell non installe." -ForegroundColor Red
    Write-Host "  Executez : Install-Module PnP.PowerShell -Scope CurrentUser -Force" -ForegroundColor Yellow
    exit 1
}
Write-OK "Module PnP.PowerShell disponible"

# ============================================================
# CONNEXION
# ============================================================
Write-Step "Connexion a SharePoint Online — $SITE_URL"
# ClientId = app Entra ID de Stukely-Sud (deja enregistree dans le tenant)
$PNP_CLIENT_ID = "f21b9923-650b-413c-8ebf-1ec8bcd02658"
try {
    Connect-PnPOnline -Url $SITE_URL -Interactive -ClientId $PNP_CLIENT_ID
    Write-OK "Connecte"
} catch {
    Write-Fail "Connexion echouee" $_.Exception.Message
    exit 1
}

# ============================================================
# LISTE : Axes_Strategiques
# ============================================================
Write-Step "Creation de la liste : $($CONFIG.ListeAxes)"

if (-not (Test-ListeExiste $CONFIG.ListeAxes)) {
    try {
        New-PnPList -Title $CONFIG.ListeAxes -Template GenericList -EnableVersioning -OnQuickLaunch | Out-Null
        Write-OK "Liste creee"
    } catch { Write-Fail "Creation liste" $_.Exception.Message; exit 1 }
} else { Write-Skip "Liste '$($CONFIG.ListeAxes)'" }

try { Set-PnPField -List $CONFIG.ListeAxes -Identity "Title" -Values @{ Title = "Nom de l'axe" } | Out-Null } catch {}

Add-Colonne -Liste $CONFIG.ListeAxes -Nom "Identifiant"      -DisplayName "Identifiant"           -Type "Text"    -Required $true
Add-Colonne -Liste $CONFIG.ListeAxes -Nom "Avancement"       -DisplayName "Avancement (%)"         -Type "Number"
Add-Colonne -Liste $CONFIG.ListeAxes -Nom "Couleur"          -DisplayName "Couleur hex"            -Type "Text"
Add-Colonne -Liste $CONFIG.ListeAxes -Nom "CouleurClaire"    -DisplayName "Couleur claire hex"     -Type "Text"
Add-Colonne -Liste $CONFIG.ListeAxes -Nom "Description_Axe"  -DisplayName "Description"           -Type "Note"

# ============================================================
# LISTE : Jalons
# ============================================================
Write-Step "Creation de la liste : $($CONFIG.ListeJalons)"

if (-not (Test-ListeExiste $CONFIG.ListeJalons)) {
    try {
        New-PnPList -Title $CONFIG.ListeJalons -Template GenericList -EnableVersioning -OnQuickLaunch | Out-Null
        Write-OK "Liste creee"
    } catch { Write-Fail "Creation liste" $_.Exception.Message; exit 1 }
} else { Write-Skip "Liste '$($CONFIG.ListeJalons)'" }

try { Set-PnPField -List $CONFIG.ListeJalons -Identity "Title" -Values @{ Title = "Titre du jalon" } | Out-Null } catch {}

Add-Colonne -Liste $CONFIG.ListeJalons -Nom "Date"           -DisplayName "Date du jalon"   -Type "DateTime" -Required $true
Add-Colonne -Liste $CONFIG.ListeJalons -Nom "Axe"            -DisplayName "Axe"             -Type "Text"
Add-Colonne -Liste $CONFIG.ListeJalons -Nom "Statut"         -DisplayName "Statut"          -Type "Choice"   -Choices @("a faire","en cours","terminee","en retard","en attente") -Default "a faire"

# ============================================================
# LISTE : Actions_Plan
# ============================================================
Write-Step "Creation de la liste : $($CONFIG.ListeActions)"

if (-not (Test-ListeExiste $CONFIG.ListeActions)) {
    try {
        New-PnPList -Title $CONFIG.ListeActions -Template GenericList -EnableVersioning -OnQuickLaunch | Out-Null
        Write-OK "Liste creee"
    } catch { Write-Fail "Creation liste" $_.Exception.Message; exit 1 }
} else { Write-Skip "Liste '$($CONFIG.ListeActions)'" }

try { Set-PnPField -List $CONFIG.ListeActions -Identity "Title" -Values @{ Title = "Titre de l'objectif" } | Out-Null } catch {}

Add-Colonne -Liste $CONFIG.ListeActions -Nom "Axe_Strategique"    -DisplayName "Axe strategique"  -Type "Text"     -Required $true
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Responsable_Nom"    -DisplayName "Responsable"       -Type "Text"     -Required $true
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Responsable_Courriel" -DisplayName "Courriel responsable" -Type "Text"
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Priorite"           -DisplayName "Priorite"          -Type "Choice"   -Choices @("haute","moyenne","basse") -Default "moyenne"
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Date_Debut"         -DisplayName "Date de debut"     -Type "DateTime"
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Date_Echeance"      -DisplayName "Date d'echeance"   -Type "DateTime" -Required $true
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Avancement"         -DisplayName "Avancement (%)"    -Type "Number"   -Required $true  -Default "0"
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Statut"             -DisplayName "Statut"            -Type "Choice"   -Choices @("a faire","en cours","terminee","en retard","en attente") -Default "a faire"
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Description"        -DisplayName "Description"       -Type "Note"
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Budget_Prevu"       -DisplayName "Budget prevu ($)"  -Type "Currency"
Add-Colonne -Liste $CONFIG.ListeActions -Nom "Commentaire_Suivi"  -DisplayName "Commentaire"       -Type "Note"

# ============================================================
# VUES — Actions_Plan
# ============================================================
Write-Step "Creation des vues"

$champsVue = @("Title","Axe_Strategique","Responsable_Nom","Priorite","Date_Echeance","Avancement","Statut")

try {
    if (-not (Get-PnPView -List $CONFIG.ListeActions | Where-Object { $_.Title -eq "Objectifs en retard" })) {
        $v = Add-PnPView -List $CONFIG.ListeActions -Title "Objectifs en retard" -Fields $champsVue
        $v = Get-PnPView -List $CONFIG.ListeActions -Identity "Objectifs en retard"
        $v.ViewQuery = "<Where><And><Lt><FieldRef Name='Date_Echeance'/><Value Type='DateTime'><Today/></Value></Lt><Neq><FieldRef Name='Statut'/><Value Type='Choice'>terminee</Value></Neq></And></Where>"
        $v.Update(); Invoke-PnPQuery
        Write-OK "Vue 'Objectifs en retard'"
    } else { Write-Skip "Vue 'Objectifs en retard'" }
} catch { Write-Fail "Vue 'Objectifs en retard'" $_.Exception.Message }

try {
    if (-not (Get-PnPView -List $CONFIG.ListeActions | Where-Object { $_.Title -eq "Par axe" })) {
        Add-PnPView -List $CONFIG.ListeActions -Title "Par axe" -Fields $champsVue | Out-Null
        Write-OK "Vue 'Par axe'"
    } else { Write-Skip "Vue 'Par axe'" }
} catch { Write-Fail "Vue 'Par axe'" $_.Exception.Message }

# ============================================================
# LISTE : Historique_Actions
# ============================================================
Write-Step "Creation de la liste : $($CONFIG.ListeHistorique)"

if (-not (Test-ListeExiste $CONFIG.ListeHistorique)) {
    try {
        New-PnPList -Title $CONFIG.ListeHistorique -Template GenericList -EnableVersioning -OnQuickLaunch | Out-Null
        Write-OK "Liste creee"
    } catch { Write-Fail "Creation liste" $_.Exception.Message; exit 1 }
} else { Write-Skip "Liste '$($CONFIG.ListeHistorique)'" }

try { Set-PnPField -List $CONFIG.ListeHistorique -Identity "Title" -Values @{ Title = "Titre de l'objectif" } | Out-Null } catch {}

Add-Colonne -Liste $CONFIG.ListeHistorique -Nom "ActionId"           -DisplayName "ID de l'objectif"    -Type "Text"  -Required $true
Add-Colonne -Liste $CONFIG.ListeHistorique -Nom "Utilisateur"        -DisplayName "Utilisateur"          -Type "Text"
Add-Colonne -Liste $CONFIG.ListeHistorique -Nom "TypeModification"   -DisplayName "Type de modification" -Type "Choice" -Choices @("Creation","Modification","Suppression")
Add-Colonne -Liste $CONFIG.ListeHistorique -Nom "Details"            -DisplayName "Details"              -Type "Note"

# ============================================================
# LISTE : Configuration
# ============================================================
Write-Step "Creation de la liste : $($CONFIG.ListeConfig)"

if (-not (Test-ListeExiste $CONFIG.ListeConfig)) {
    try {
        New-PnPList -Title $CONFIG.ListeConfig -Template GenericList -EnableVersioning -OnQuickLaunch | Out-Null
        Write-OK "Liste creee"
    } catch { Write-Fail "Creation liste" $_.Exception.Message; exit 1 }
} else { Write-Skip "Liste '$($CONFIG.ListeConfig)'" }

try { Set-PnPField -List $CONFIG.ListeConfig -Identity "Title" -Values @{ Title = "Clé de configuration" } | Out-Null } catch {}

Add-Colonne -Liste $CONFIG.ListeConfig -Nom "Valeur" -DisplayName "Valeur (JSON)" -Type "Note"

# Créer l'item de configuration initial si absent
try {
    $existing = Get-PnPListItem -List $CONFIG.ListeConfig -Query "<View><Query><Where><Eq><FieldRef Name='Title'/><Value Type='Text'>dashboard_config</Value></Eq></Where></Query></View>"
    if ($existing.Count -eq 0) {
        Add-PnPListItem -List $CONFIG.ListeConfig -Values @{ Title = "dashboard_config"; Valeur = "{}" } | Out-Null
        Write-OK "Item de configuration initial cree"
    } else {
        Write-Skip "Item dashboard_config"
    }
} catch { Write-Fail "Creation item config" $_.Exception.Message }

# ============================================================
# RÉSUMÉ
# ============================================================
Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "  Deploiement termine — Stukely-Sud"              -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Listes creees :"                                              -ForegroundColor White
Write-Host "  - Actions    : $SITE_URL/Lists/Actions_Plan"                 -ForegroundColor White
Write-Host "  - Axes       : $SITE_URL/Lists/Axes_Strategiques"            -ForegroundColor White
Write-Host "  - Jalons     : $SITE_URL/Lists/Jalons"                       -ForegroundColor White
Write-Host "  - Historique : $SITE_URL/Lists/Historique_Actions"           -ForegroundColor White
Write-Host "  - Config     : $SITE_URL/Lists/Configuration"               -ForegroundColor White
Write-Host ""
Write-Host "  Prochaine etape :"                                            -ForegroundColor Yellow
Write-Host "  1. Pousser sur https://github.com/DGStukely/Tableau-de-bord2" -ForegroundColor Yellow
Write-Host ""

Disconnect-PnPOnline
Write-Host "  Deconnecte." -ForegroundColor Gray
