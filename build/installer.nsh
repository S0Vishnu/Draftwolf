; -------------------------------------------------------------------
; DraftWolf — Windows Explorer "Open with DraftWolf" context menu
; -------------------------------------------------------------------
; This NSIS include adds right-click context menu entries for:
;   1. Folders (right-click a folder → "Open with DraftWolf")
;   2. Directory background (right-click inside a folder → "Open with DraftWolf")
; -------------------------------------------------------------------

!macro customInstall
  ; --- Folder context menu (right-click ON a folder) ---
  WriteRegStr HKCU "Software\Classes\Directory\shell\DraftWolf" "" "Open with DraftWolf"
  WriteRegStr HKCU "Software\Classes\Directory\shell\DraftWolf" "Icon" "$INSTDIR\DraftWolf.exe,0"
  WriteRegStr HKCU "Software\Classes\Directory\shell\DraftWolf\command" "" '"$INSTDIR\DraftWolf.exe" "%V"'

  ; --- Directory background context menu (right-click INSIDE a folder) ---
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DraftWolf" "" "Open with DraftWolf"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DraftWolf" "Icon" "$INSTDIR\DraftWolf.exe,0"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DraftWolf\command" "" '"$INSTDIR\DraftWolf.exe" "%V"'
!macroend

!macro customUnInstall
  ; --- Remove folder context menu ---
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DraftWolf"

  ; --- Remove directory background context menu ---
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DraftWolf"
!macroend
