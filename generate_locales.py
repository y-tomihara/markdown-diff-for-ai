import json

langs = {
    'es': {
        'name': 'Español',
        'trans': {
            'command.selectAsAfter.title': 'Seleccionar como Después',
            'command.selectAsBefore.title': 'Seleccionar como Antes',
            'command.compareWithHead.title': 'Git: Comparar con HEAD',
            'command.compareWithPrevious.title': 'Git: Comparar con el cambio anterior',
            'command.compareWithCommit.title': 'Git: Seleccionar commit...',
            'command.compareWithBranch.title': 'Git: Seleccionar rama...',
            'config.defaultSensitivity.desc': 'Umbral de sensibilidad predeterminado.',
            'config.defaultSensitivity.title': 'Markdown Diff for AI',
            'config.commitHistoryLimit.desc': 'Número máximo de commits a mostrar.',
            'webview.before': 'Antes (Before)',
            'webview.after': 'Después (After)',
            'webview.selectFile': 'Seleccionar archivo...',
            'webview.notSelected': 'No seleccionado',
            'webview.compare': 'Comparar',
            'webview.clear': 'Limpiar',
            'webview.sensitivity': 'Sensibilidad',
            'webview.sensitivityTooltip': 'Bajo = Agrupado. Alto = Estricto.',
            'webview.computing': 'Calculando diferencias...',
            'error.computing': 'Error:'
        },
        'readme': '# Markdown Diff for AI\n\n*[English](README.md)* | *[日本語](README.ja.md)* | *[中文](README.zh.md)* | *[한국어](README.ko.md)* | *[Español](README.es.md)* | *[Deutsch](README.de.md)* | *[Français](README.fr.md)* | *[Português](README.pt-br.md)*\n\nMarkdown Diff for AI es una extensión de VS Code para comparar archivos Markdown...\n\n![Markdown Diff Screenshot](images/img_0001_markdown_diff_screenshot_en.png)'
    },
    'de': {
        'name': 'Deutsch',
        'trans': {
            'command.selectAsAfter.title': 'Als Danach auswählen',
            'command.selectAsBefore.title': 'Als Zuvor auswählen',
            'command.compareWithHead.title': 'Git: Mit HEAD vergleichen',
            'command.compareWithPrevious.title': 'Git: Mit vorheriger Änderung vergleichen',
            'command.compareWithCommit.title': 'Git: Commit auswählen...',
            'command.compareWithBranch.title': 'Git: Branch auswählen...',
            'config.defaultSensitivity.desc': 'Standard-Empfindlichkeitsschwellenwert.',
            'config.defaultSensitivity.title': 'Markdown Diff for AI',
            'config.commitHistoryLimit.desc': 'Maximale Anzahl von Commits.',
            'webview.before': 'Zuvor (Before)',
            'webview.after': 'Danach (After)',
            'webview.selectFile': 'Datei auswählen...',
            'webview.notSelected': 'Nicht ausgewählt',
            'webview.compare': 'Vergleichen',
            'webview.clear': 'Löschen',
            'webview.sensitivity': 'Empfindlichkeit',
            'webview.sensitivityTooltip': 'Niedrig = Gruppiert. Hoch = Streng.',
            'webview.computing': 'Unterschiede berechnen...',
            'error.computing': 'Fehler:'
        },
        'readme': '# Markdown Diff for AI\n\n*[English](README.md)* | *[日本語](README.ja.md)* | *[中文](README.zh.md)* | *[한국어](README.ko.md)* | *[Español](README.es.md)* | *[Deutsch](README.de.md)* | *[Français](README.fr.md)* | *[Português](README.pt-br.md)*\n\nMarkdown Diff for AI ist eine VS Code-Erweiterung zum Vergleichen von Markdown-Dateien...\n\n![Markdown Diff Screenshot](images/img_0001_markdown_diff_screenshot_en.png)'
    },
    'fr': {
        'name': 'Français',
        'trans': {
            'command.selectAsAfter.title': 'Sélectionner comme Après',
            'command.selectAsBefore.title': 'Sélectionner comme Avant',
            'command.compareWithHead.title': 'Git: Comparer avec HEAD',
            'command.compareWithPrevious.title': 'Git: Comparer avec modification précédente',
            'command.compareWithCommit.title': 'Git: Sélectionner un commit...',
            'command.compareWithBranch.title': 'Git: Sélectionner une branche...',
            'config.defaultSensitivity.desc': 'Seuil de sensibilité par défaut.',
            'config.defaultSensitivity.title': 'Markdown Diff for AI',
            'config.commitHistoryLimit.desc': 'Nombre maximum de commits.',
            'webview.before': 'Avant (Before)',
            'webview.after': 'Après (After)',
            'webview.selectFile': 'Sélectionner un fichier...',
            'webview.notSelected': 'Non sélectionné',
            'webview.compare': 'Comparer',
            'webview.clear': 'Effacer',
            'webview.sensitivity': 'Sensibilité',
            'webview.sensitivityTooltip': 'Bas = Groupé. Haut = Strict.',
            'webview.computing': 'Calcul des différences...',
            'error.computing': 'Erreur:'
        },
        'readme': '# Markdown Diff for AI\n\n*[English](README.md)* | *[日本語](README.ja.md)* | *[中文](README.zh.md)* | *[한국어](README.ko.md)* | *[Español](README.es.md)* | *[Deutsch](README.de.md)* | *[Français](README.fr.md)* | *[Português](README.pt-br.md)*\n\nMarkdown Diff for AI est une extension VS Code pour comparer des fichiers Markdown...\n\n![Markdown Diff Screenshot](images/img_0001_markdown_diff_screenshot_en.png)'
    },
    'pt-br': {
        'name': 'Português (Brasil)',
        'trans': {
            'command.selectAsAfter.title': 'Selecionar como Depois',
            'command.selectAsBefore.title': 'Selecionar como Antes',
            'command.compareWithHead.title': 'Git: Comparar com HEAD',
            'command.compareWithPrevious.title': 'Git: Comparar com a alteração anterior',
            'command.compareWithCommit.title': 'Git: Selecionar commit...',
            'command.compareWithBranch.title': 'Git: Selecionar branch...',
            'config.defaultSensitivity.desc': 'Limite de sensibilidade padrão.',
            'config.defaultSensitivity.title': 'Markdown Diff for AI',
            'config.commitHistoryLimit.desc': 'Número máximo de commits.',
            'webview.before': 'Antes (Before)',
            'webview.after': 'Depois (After)',
            'webview.selectFile': 'Selecionar arquivo...',
            'webview.notSelected': 'Não selecionado',
            'webview.compare': 'Comparar',
            'webview.clear': 'Limpar',
            'webview.sensitivity': 'Sensibilidade',
            'webview.sensitivityTooltip': 'Baixo = Agrupado. Alto = Estrito.',
            'webview.computing': 'Calculando diferenças...',
            'error.computing': 'Erro:'
        },
        'readme': '# Markdown Diff for AI\n\n*[English](README.md)* | *[日本語](README.ja.md)* | *[中文](README.zh.md)* | *[한국어](README.ko.md)* | *[Español](README.es.md)* | *[Deutsch](README.de.md)* | *[Français](README.fr.md)* | *[Português](README.pt-br.md)*\n\nMarkdown Diff for AI é uma extensão do VS Code para comparar arquivos Markdown...\n\n![Markdown Diff Screenshot](images/img_0001_markdown_diff_screenshot_en.png)'
    }
}

for code, data in langs.items():
    with open(f"package.nls.{code}.json", "w", encoding="utf-8") as f:
        json.dump(data["trans"], f, indent=2, ensure_ascii=False)
    with open(f"README.{code}.md", "w", encoding="utf-8") as f:
        f.write(data["readme"])
print("Done")
