bl_info = {
    "name": "DraftWolf Control",
    "author": "DraftWolf",
    "version": (1, 0),
    "blender": (2, 80, 0),
    "location": "View3D > Sidebar > DraftWolf",
    "description": "Version control for Blender with DraftWolf",
    "category": "Development",
}

import bpy
import json
import urllib.request
import urllib.error
import os
import subprocess
import sys
import shutil

API_PORT = 45000
API_URL = f"http://127.0.0.1:{API_PORT}"

# --- Helper Functions ---

def send_request(endpoint, data=None):
    url = f"{API_URL}{endpoint}"
    req = urllib.request.Request(url)
    req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', 'DraftWolf-Blender/1.0')
    
    if data:
        jsondata = json.dumps(data).encode('utf-8')
        req.data = jsondata # IMPLIES POST
        
    try:
        # Reduced timeout to 3 seconds for faster detection
        with urllib.request.urlopen(req, timeout=3) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"DraftWolf API Error: {e.code}")
        try:
            err_body = e.read().decode('utf-8')
            return json.loads(err_body)
        except:
            return {'success': False, 'error': f"HTTP {e.code}"}
    except (urllib.error.URLError, TimeoutError, ConnectionRefusedError, OSError) as e:
        # More comprehensive error handling for different systems
        print(f"DraftWolf Connection Error: {e}")
        return {'success': False, 'error': str(e)}

def get_project_root(filepath):
    if not filepath:
        return None
    # We send the directory so find-root can traverse up
    res = send_request('/draft/find-root', {'path': os.path.dirname(filepath)})
    return res.get('root') if res else None

def check_app_status():
    """Check if DraftWolf app is installed and running (with caching)"""
    import time
    current_time = time.time()
    
    # Return cached value if still valid
    if current_time - StatusCache.last_check_time < StatusCache.cache_duration:
        return StatusCache.app_running
    
    # Update cache
    res = send_request('/health')
    StatusCache.app_running = bool(res and res.get('success'))
    StatusCache.last_check_time = current_time
    
    # If app is not running, reset login status
    if not StatusCache.app_running:
        StatusCache.is_logged_in = False
        StatusCache.username = None
    
    return StatusCache.app_running

def check_login_status():
    """Check if user is logged into DraftWolf (with caching)"""
    import time
    current_time = time.time()
    
    # Return cached value if still valid
    if current_time - StatusCache.last_check_time < StatusCache.cache_duration:
        return StatusCache.is_logged_in, StatusCache.username
    
    # Only check login if app is running
    if not StatusCache.app_running:
        return False, None
    
    # Update cache
    res = send_request('/auth/status')
    if res and res.get('loggedIn'):
        StatusCache.is_logged_in = True
        StatusCache.username = res.get('username', 'User')
    else:
        StatusCache.is_logged_in = False
        StatusCache.username = None
    
    return StatusCache.is_logged_in, StatusCache.username

def load_version_history(filepath):
    """Load and filter version history for the current file"""
    if not filepath:
        return []
    
    root = get_project_root(filepath)
    if not root:
        return []
    
    # Get full history
    history = send_request('/draft/history', {'projectRoot': root})
    if not history:
        return []
    
    # Filter for current file
    import re
    target_file = os.path.basename(filepath)
    name, ext = os.path.splitext(target_file)
    
    # Clean up filename
    clean_name = name
    if ' retrieved version' in clean_name.lower():
        idx = clean_name.lower().find(' retrieved version')
        clean_name = clean_name[:idx]
    elif '-retrieved' in clean_name:
        clean_name = clean_name.replace('-retrieved', '')
        clean_name = re.sub(r'-v[\d\.]+$', '', clean_name)
        clean_name = re.sub(r'-\d+$', '', clean_name)
    
    target_file = clean_name + ext
    target_lower = target_file.lower()
    
    filtered_history = []
    for v in history:
        files = v.get('files', {})
        for f_path in files.keys():
            f_name = os.path.basename(f_path)
            if f_name.lower() == target_lower:
                filtered_history.append(v)
                break
    
    return filtered_history

# --- Global State for UI ---
class SafeVersionList:
    items = []
    full_history = []
    show_versions = False  # For collapsible UI

class StatusCache:
    """Cache for app and login status to prevent excessive network calls"""
    app_running = False
    is_logged_in = False
    username = None
    last_check_time = 0
    cache_duration = 2.0  # Cache for 2 seconds to reduce lag

# --- Operators ---

class OBJECT_OT_DfCommit(bpy.types.Operator):
    """Save your current work as a new version (like a checkpoint)"""
    bl_idname = "draftwolf.commit"
    bl_label = "Save Version"
    bl_options = {'REGISTER', 'UNDO'}
    
    label_input: bpy.props.StringProperty(name="Label", default="New Version")

    def execute(self, context):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'ERROR'}, "Please save your .blend file first (File > Save As)")
            return {'CANCELLED'}
        
        # Force save to disk so we version the latest changes
        bpy.ops.wm.save_mainfile()
        
        root = get_project_root(filepath)
        if not root:
            self.report({'ERROR'}, "Version control not enabled. Click 'Enable Version Control' first.")
            return {'CANCELLED'}
            
        res = send_request('/draft/commit', {
            'projectRoot': root,
            'label': self.label_input,
            'files': [filepath]
        })
        
        if res and res.get('success'):
            self.report({'INFO'}, f"✓ Version saved successfully! (v{res.get('versionNumber', '?')})")
            # Auto-refresh version history
            SafeVersionList.full_history = load_version_history(filepath)
        else:
            err = res.get('error', 'Unknown Error') if res else "Cannot connect to DraftWolf App"
            self.report({'ERROR'}, f"Failed to save: {err}")
            
        return {'FINISHED'}

    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self)


class OBJECT_OT_DfCommitLastSaved(bpy.types.Operator):
    """Save version of the last saved state (without current unsaved changes)"""
    bl_idname = "draftwolf.commit_last_saved"
    bl_label = "Save Last Saved as Version"
    bl_options = {'REGISTER', 'UNDO'}
    
    label_input: bpy.props.StringProperty(name="Label", default="New Version")

    def execute(self, context):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'ERROR'}, "Please save your .blend file first (File > Save As)")
            return {'CANCELLED'}
        
        # DO NOT save to disk - version the file as it is on disk
        
        root = get_project_root(filepath)
        if not root:
            self.report({'ERROR'}, "Version control not enabled. Click 'Enable Version Control' first.")
            return {'CANCELLED'}
            
        res = send_request('/draft/commit', {
            'projectRoot': root,
            'label': self.label_input,
            'files': [filepath]
        })
        
        if res and res.get('success'):
            self.report({'INFO'}, f"✓ Last saved state versioned! (v{res.get('versionNumber', '?')})")
            # Auto-refresh version history
            SafeVersionList.full_history = load_version_history(filepath)
        else:
            err = res.get('error', 'Unknown Error') if res else "Cannot connect to DraftWolf App"
            self.report({'ERROR'}, f"Failed to save: {err}")
            
        return {'FINISHED'}

    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self)


class OBJECT_OT_DfRetrieve(bpy.types.Operator):
    """Go back to a previous version of your work"""
    bl_idname = "draftwolf.retrieve"
    bl_label = "Restore Version"
    bl_options = {'REGISTER'}
    
    def get_items(self, context):
        return SafeVersionList.items

    version_enum: bpy.props.EnumProperty(items=get_items, name="Select Version")
    
    def execute(self, context):
        version_id = self.version_enum
        filepath = bpy.data.filepath
        
        if not version_id:
            return {'CANCELLED'}

        root = get_project_root(filepath)
        if not root:
            return {'CANCELLED'}
        
        # 1. Identify File Info (Recover original path logic)
        filename = os.path.basename(filepath)
        name, ext = os.path.splitext(filename)
        req_filepath = filepath
        
        # Logic to recover original name if we are inside a retrieved file
        if name.endswith('-retrieved-version') or '-retrieved-version-' in name:
             split_key = '-retrieved-version'
             if split_key in name:
                 original_name_part = name.split(split_key)[0]
                 req_filepath = os.path.join(os.path.dirname(filepath), original_name_part + ext)
        elif name.endswith('-retrieved'):
            temp = name[:-len('-retrieved')]
            if '-' in temp:
                original_name_part = temp.rsplit('-', 1)[0]
                req_filepath = os.path.join(os.path.dirname(filepath), original_name_part + ext)

        # 2. Perform Restore (Overwrite)
        # Check if we are overwriting the currently open file
        is_open_file = False
        try:
            if os.path.samefile(filepath, req_filepath):
                is_open_file = True
        except:
            if os.path.normpath(filepath) == os.path.normpath(req_filepath):
                is_open_file = True

        if is_open_file:
            # We must release the lock on Windows
            # Create new file temporarily
            bpy.ops.wm.read_homefile(app_template="") 
        
        # Call API
        res = send_request('/draft/restore', {
            'projectRoot': root,
            'versionId': version_id
        })
        
        if res and res.get('success'):
            self.report({'INFO'}, f"Restored Version {version_id}")
            # Re-open the restored file
            try:
                bpy.ops.wm.open_mainfile(filepath=req_filepath)
            except Exception as e:
                self.report({'ERROR'}, f"Restored but failed to open: {e}")
        else:
            err = res.get('error', 'Unknown Error') if res else "Connection Error"
            self.report({'ERROR'}, f"Restore failed: {err}")
            # If we closed it, try to re-open original (it might still be old version or broken)
            if is_open_file:
                 try:
                    bpy.ops.wm.open_mainfile(filepath=req_filepath)
                 except: pass

        return {'FINISHED'}

    def invoke(self, context, event):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'ERROR'}, "Please save your .blend file first")
            return {'CANCELLED'}
            
        root = get_project_root(filepath)
        if not root:
            self.report({'ERROR'}, "Version control not enabled for this project")
            return {'CANCELLED'}
            
        rel_path = None
        if root and filepath:
            # Handle retrieved files by stripping suffixes to find original
            filename = os.path.basename(filepath)
            name, ext = os.path.splitext(filename)
            real_filepath = filepath

            # Simplified recovery logic similar to execute()
            if '-retrieved' in name:
                # Try to strip standard suffix patterns
                 clean_name = name
                 if clean_name.endswith('-retrieved'):
                     clean_name = clean_name[:-len('-retrieved')]
                 
                 # Try removing version suffix [-v1.0] if present
                 if '-' in clean_name:
                     parts = clean_name.rsplit('-', 1)
                     # Heuristic: if last part looks like a version (starts with v or number)
                     if parts[-1].startswith('v') or parts[-1].replace('.','').isdigit():
                         clean_name = parts[0]
                         
                 real_filepath = os.path.join(os.path.dirname(filepath), clean_name + ext)

            try:
                # Strict path calculation
                root_abs = os.path.abspath(root)
                filepath_abs = os.path.abspath(real_filepath)
                
                if os.name == 'nt':
                    if os.path.splitdrive(root_abs)[0].lower() != os.path.splitdrive(filepath_abs)[0].lower():
                         # Fallback to current file if recovery failed and drives differ (unlikely but safe)
                         filepath_abs = os.path.abspath(filepath) 

                rel_path = os.path.relpath(filepath_abs, root_abs)
                if rel_path.startswith('..'): rel_path = None # Outside root
                    
            except ValueError:
                pass

        if not rel_path:
            self.report({'ERROR'}, "Could not resolve file path relative to project.")
            return {'CANCELLED'}
            
        # Normalize to forward slashes for API
        rel_path = rel_path.replace('\\', '/')

        # Request FULL history (no targetFile) to match App logic and filter client-side
        history = send_request('/draft/history', {'projectRoot': root})
        
        if history is None:
             self.report({'ERROR'}, "Could not connect to DraftWolf App.")
             return {'CANCELLED'}
             
        if not history:
            self.report({'WARNING'}, "No version history found.")
            return {'CANCELLED'}

        # Client-side filtering: Match by filename (Basename)
        # This is robust against directory changes and path naming issues.
        
        # 1. Clean up the filename to find the "Original" name
        import re
        target_file = os.path.basename(filepath)
        name, ext = os.path.splitext(target_file)
        
        # The retrieve operation creates files with pattern: "[original name] retrieved version.blend"
        # We need to strip " retrieved version" and any version identifiers
        clean_name = name
        
        # Strip " retrieved version" suffix (note the space)
        if ' retrieved version' in clean_name.lower():
            # Find the position and cut everything from there
            idx = clean_name.lower().find(' retrieved version')
            clean_name = clean_name[:idx]
        
        # Also handle the old pattern with hyphens: "name-v2-retrieved"
        elif '-retrieved' in clean_name:
            clean_name = clean_name.replace('-retrieved', '')
            # Strip version suffixes like -v2, -v2.1
            clean_name = re.sub(r'-v[\d\.]+$', '', clean_name)
            # Strip simple number suffixes from duplicate downloads like -1
            clean_name = re.sub(r'-\d+$', '', clean_name)
        
        target_file = clean_name + ext
        target_lower = target_file.lower()
        
        filtered_history = []
        
        for v in history:
            files = v.get('files', {})
            # Check if any file in this version has the same filename
            for f_path in files.keys():
                f_name = os.path.basename(f_path)
                if f_name.lower() == target_lower:
                    filtered_history.append(v)
                    break
        
        history = filtered_history 
        
        if not history:
             self.report({'WARNING'}, f"No versions found for '{target_file}'")
             return {'CANCELLED'} 

        # Repopulate the list
            
        # Repopulate the list
        SafeVersionList.items = []
        for v in history:
            vid = v.get('id')
            vnum = v.get('versionNumber', '0')
            vlbl = v.get('label', 'Untitled')
            vtime = v.get('timestamp', '').split('T')[0] # Simple date
            
            # (identifier, name, description)
            display_name = f"v{vnum}: {vlbl} ({vtime})"
            SafeVersionList.items.append((vid, display_name, vlbl))
            
        return context.window_manager.invoke_props_dialog(self)



class OBJECT_OT_DfInit(bpy.types.Operator):
    """Enable version control for this project (one-time setup)"""
    bl_idname = "draftwolf.init"
    bl_label = "Enable Version Control"
    bl_options = {'REGISTER'}

    def execute(self, context):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'ERROR'}, "Please save your .blend file first (File > Save As)")
            return {'CANCELLED'}
            
        directory = os.path.dirname(filepath)
        
        res = send_request('/draft/init', {'projectRoot': directory})
        if res and res.get('success'):
            self.report({'INFO'}, "✓ Version control enabled! You can now save versions.")
        else:
            err = res.get('error', 'Unknown Error') if res else "Cannot connect to DraftWolf App"
            self.report({'ERROR'}, f"Setup failed: {err}")
            
        return {'FINISHED'}


class OBJECT_OT_DfOpenApp(bpy.types.Operator):
    """Open the DraftWolf app to view full version history and manage projects"""
    bl_idname = "draftwolf.open_app"
    bl_label = "Open DraftWolf App"

    def execute(self, context):
        try:
            # Send current file path to app via deep link?
            # myapp://open?path=...
            filepath = bpy.data.filepath
            url = "myapp://open"
            if filepath:
                # Basic URL encoding
                safe_path = urllib.request.pathname2url(filepath)
                url += f"?path={safe_path}"

            if sys.platform == 'win32':
                os.startfile(url)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', url])
            else:
                subprocess.Popen(['xdg-open', url])
                
        except Exception as e:
            self.report({'ERROR'}, f"Failed to open app: {e}")
            
        return {'FINISHED'}


class OBJECT_OT_DfDownloadApp(bpy.types.Operator):
    """Download DraftWolf application"""
    bl_idname = "draftwolf.download_app"
    bl_label = "Download DraftWolf"

    def execute(self, context):
        try:
            # TODO: Replace with website URL when available
            url = "https://github.com/S0Vishnu/Draftflow-app"
            
            if sys.platform == 'win32':
                os.startfile(url)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', url])
            else:
                subprocess.Popen(['xdg-open', url])
                
            self.report({'INFO'}, "Opening download page...")
        except Exception as e:
            self.report({'ERROR'}, f"Failed to open download page: {e}")
            
        return {'FINISHED'}


class OBJECT_OT_DfLogin(bpy.types.Operator):
    """Open DraftWolf app to login"""
    bl_idname = "draftwolf.login"
    bl_label = "Login to DraftWolf"

    def execute(self, context):
        try:
            # Open app to login page
            url = "myapp://login"
            
            if sys.platform == 'win32':
                os.startfile(url)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', url])
            else:
                subprocess.Popen(['xdg-open', url])
                
            self.report({'INFO'}, "Opening DraftWolf to login...")
        except Exception as e:
            self.report({'ERROR'}, f"Failed to open login: {e}")
            
        return {'FINISHED'}


class OBJECT_OT_DfToggleVersions(bpy.types.Operator):
    """Toggle version history display"""
    bl_idname = "draftwolf.toggle_versions"
    bl_label = "Show/Hide Versions"

    def execute(self, context):
        SafeVersionList.show_versions = not SafeVersionList.show_versions
        return {'FINISHED'}


class OBJECT_OT_DfRefreshVersions(bpy.types.Operator):
    """Refresh version history list"""
    bl_idname = "draftwolf.refresh_versions"
    bl_label = "Refresh Versions"

    def execute(self, context):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'WARNING'}, "Save file first")
            return {'CANCELLED'}
        
        # Reload version history
        SafeVersionList.full_history = load_version_history(filepath)
        self.report({'INFO'}, f"✓ Refreshed! Found {len(SafeVersionList.full_history)} versions")
        return {'FINISHED'}


class OBJECT_OT_DfRestoreQuick(bpy.types.Operator):
    """Quickly restore a specific version"""
    bl_idname = "draftwolf.restore_quick"
    bl_label = "Restore This Version"
    bl_options = {'REGISTER'}
    
    version_id: bpy.props.StringProperty()
    
    def execute(self, context):
        filepath = bpy.data.filepath
        
        if not self.version_id:
            return {'CANCELLED'}

        root = get_project_root(filepath)
        if not root:
            return {'CANCELLED'}
        
        # Identify File Info (Recover original path logic)
        filename = os.path.basename(filepath)
        name, ext = os.path.splitext(filename)
        req_filepath = filepath
        
        # Logic to recover original name if we are inside a retrieved file
        if name.endswith('-retrieved-version') or '-retrieved-version-' in name:
             split_key = '-retrieved-version'
             if split_key in name:
                 original_name_part = name.split(split_key)[0]
                 req_filepath = os.path.join(os.path.dirname(filepath), original_name_part + ext)
        elif name.endswith('-retrieved'):
            temp = name[:-len('-retrieved')]
            if '-' in temp:
                original_name_part = temp.rsplit('-', 1)[0]
                req_filepath = os.path.join(os.path.dirname(filepath), original_name_part + ext)

        # Check if we are overwriting the currently open file
        is_open_file = False
        try:
            if os.path.samefile(filepath, req_filepath):
                is_open_file = True
        except:
            if os.path.normpath(filepath) == os.path.normpath(req_filepath):
                is_open_file = True

        if is_open_file:
            # We must release the lock on Windows
            bpy.ops.wm.read_homefile(app_template="") 
        
        # Call API
        res = send_request('/draft/restore', {
            'projectRoot': root,
            'versionId': self.version_id
        })
        
        if res and res.get('success'):
            self.report({'INFO'}, f"✓ Version restored successfully")
            # Re-open the restored file
            try:
                bpy.ops.wm.open_mainfile(filepath=req_filepath)
            except Exception as e:
                self.report({'ERROR'}, f"Restored but failed to open: {e}")
        else:
            err = res.get('error', 'Unknown Error') if res else "Connection Error"
            self.report({'ERROR'}, f"Restore failed: {err}")
            # If we closed it, try to re-open original
            if is_open_file:
                 try:
                    bpy.ops.wm.open_mainfile(filepath=req_filepath)
                 except: pass

        return {'FINISHED'}


class OBJECT_OT_DfRenameVersion(bpy.types.Operator):
    """Rename a version's label"""
    bl_idname = "draftwolf.rename_version"
    bl_label = "Rename Version"
    bl_options = {'REGISTER', 'UNDO'}
    
    version_id: bpy.props.StringProperty(options={'HIDDEN'})
    new_label: bpy.props.StringProperty(name="New Label", default="")
    
    def execute(self, context):
        filepath = bpy.data.filepath
        
        if not self.version_id or not self.new_label.strip():
            return {'CANCELLED'}

        root = get_project_root(filepath)
        if not root:
            return {'CANCELLED'}
        
        # Call API to rename
        res = send_request('/draft/rename-version', {
            'projectRoot': root,
            'versionId': self.version_id,
            'newLabel': self.new_label.strip()
        })
        
        if res and res.get('success'):
            self.report({'INFO'}, f"✓ Version renamed successfully")
            # Refresh version history
            SafeVersionList.full_history = load_version_history(filepath)
        else:
            err = res.get('error', 'Unknown Error') if res else "Connection Error"
            self.report({'ERROR'}, f"Rename failed: {err}")

        return {'FINISHED'}
    
    def invoke(self, context, event):
        # Find the current label for this version
        for v in SafeVersionList.full_history:
            if v.get('id') == self.version_id:
                self.new_label = v.get('label', 'Untitled')
                break
        return context.window_manager.invoke_props_dialog(self)


class OBJECT_OT_DfRefreshStatus(bpy.types.Operator):
    """Refresh connection status with DraftWolf app"""
    bl_idname = "draftwolf.refresh_status"
    bl_label = "Refresh Status"

    def execute(self, context):
        # Force cache invalidation
        StatusCache.last_check_time = 0
        
        # Check status
        app_running = check_app_status()
        is_logged_in, username = check_login_status()
        
        if app_running:
            if is_logged_in:
                self.report({'INFO'}, f"✓ Connected! Logged in as {username}")
            else:
                self.report({'INFO'}, "✓ App detected but not logged in")
        else:
            self.report({'WARNING'}, "App not detected. Make sure DraftWolf is running.")
        
        return {'FINISHED'}


# --- Panel ---

class DF_PT_MainPanel(bpy.types.Panel):
    bl_label = "DraftWolf"
    bl_idname = "DF_PT_MainPanel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'DraftWolf'

    def draw(self, context):
        layout = self.layout
        layout.use_property_split = True
        layout.use_property_decorate = False
        
        # Check all statuses
        filepath = bpy.data.filepath
        is_saved = bool(filepath)
        is_initialized = False
        app_running = check_app_status()
        is_logged_in, username = check_login_status()
        
        if is_saved:
            root = get_project_root(filepath)
            is_initialized = bool(root)
        
        # ===== LOGIN STATUS BAR =====
        if app_running and is_logged_in:
            status_box = layout.box()
            row = status_box.row()
            row.label(text=f"✓ Logged in as: {username}", icon='USER')
        
        # ===== STEP 1: GETTING STARTED =====
        box = layout.box()
        box.label(text="① Getting Started", icon='INFO')
        
        if not is_saved:
            box.label(text="Save your .blend file first", icon='ERROR')
            box.operator("wm.save_as_mainfile", text="Save File", icon='FILE_TICK')
        elif not is_initialized:
            box.label(text="Enable version control for this project")
            row = box.row(align=True)
            row.scale_y = 1.2
            row.operator("draftwolf.init", text="Enable Version Control", icon="CHECKMARK")
        else:
            box.label(text="✓ Project Ready", icon='CHECKMARK')
        
        # ===== STEP 2: VERSION CONTROL =====
        box = layout.box()
        box.label(text="② Manage Versions", icon='FILE_FOLDER')
        
        if not is_initialized:
            box.enabled = False
            box.label(text="Complete Step ① first", icon='INFO')
        else:
            # Check if file has unsaved changes
            has_unsaved = bpy.data.is_dirty
            
            # Save Version - show different options based on unsaved changes
            if has_unsaved:
                # File has unsaved changes - show both options
                box.label(text="Unsaved changes detected:", icon='ERROR')
                
                # Option 1: Save current work and create version
                row = box.row(align=True)
                row.scale_y = 1.2
                row.operator("draftwolf.commit", text="Save & Create Version", icon="FILE_TICK")
                
                # Option 2: Create version of last saved state
                row = box.row(align=True)
                row.scale_y = 1.0
                row.operator("draftwolf.commit_last_saved", text="Version Last Saved Only", icon="DISK_DRIVE")
            else:
                # File is clean - show single option
                row = box.row(align=True)
                row.scale_y = 1.3
                row.operator("draftwolf.commit", text="Save Version", icon="EXPORT")
            
            # Version History - Collapsible
            # Load version history if not already loaded
            if not SafeVersionList.full_history and is_initialized:
                SafeVersionList.full_history = load_version_history(filepath)
            
            # Toggle button with refresh button
            row = box.row(align=True)
            icon = 'DOWNARROW_HLT' if SafeVersionList.show_versions else 'RIGHTARROW'
            row.operator("draftwolf.toggle_versions", 
                        text=f"Version History ({len(SafeVersionList.full_history)} saved)",
                        icon=icon, emboss=False)
            # Refresh button
            row.operator("draftwolf.refresh_versions", text="", icon="FILE_REFRESH")

            
            # Show version list if expanded
            if SafeVersionList.show_versions and SafeVersionList.full_history:
                version_box = box.box()
                
                # Display versions
                for v in SafeVersionList.full_history[:10]:  # Show last 10 versions
                    vid = v.get('id')
                    vlbl = v.get('label', 'Untitled')
                    vtime = v.get('timestamp', '').split('T')[0]  # Simple date
                    
                    # Create row for each version
                    row = version_box.row(align=True)
                    
                    # Version info (no version number to avoid confusion)
                    row.label(text=f"{vlbl} ({vtime})", icon='FILE')
                    
                    # Rename button - using GREASEPENCIL icon (looks like edit/pen)
                    rename_op = row.operator("draftwolf.rename_version", text="", icon="GREASEPENCIL")
                    rename_op.version_id = vid
                    
                    # Restore button - using LOOP_BACK icon (looks like undo/restore)
                    restore_op = row.operator("draftwolf.restore_quick", text="", icon="LOOP_BACK")
                    restore_op.version_id = vid
                
                if len(SafeVersionList.full_history) > 10:
                    version_box.label(text=f"+ {len(SafeVersionList.full_history) - 10} more versions")
        
        # ===== STEP 3: DRAFTWOLF APP =====
        box = layout.box()
        
        # Header with refresh button
        row = box.row(align=True)
        row.label(text="③ DraftWolf App", icon='WINDOW')
        row.operator("draftwolf.refresh_status", text="", icon="FILE_REFRESH")
        
        if not app_running:
            # App not installed/running
            box.label(text="App not detected", icon='ERROR')
            box.label(text="Make sure DraftWolf is running")
            row = box.row(align=True)
            row.scale_y = 1.2
            row.operator("draftwolf.download_app", text="Download App", icon="INTERNET")
        elif not is_logged_in:
            # App running but not logged in
            box.label(text="Please login to continue", icon='INFO')
            row = box.row(align=True)
            row.scale_y = 1.2
            row.operator("draftwolf.login", text="Login to DraftWolf", icon="USER")
        else:
            # All good - show app button
            row = box.row(align=True)
            row.scale_y = 1.2
            row.operator("draftwolf.open_app", text="Open DraftWolf App", icon="URL")


# --- Registration ---

classes = (
    OBJECT_OT_DfCommit,
    OBJECT_OT_DfCommitLastSaved,
    OBJECT_OT_DfRetrieve,
    OBJECT_OT_DfInit,
    OBJECT_OT_DfOpenApp,
    OBJECT_OT_DfDownloadApp,
    OBJECT_OT_DfLogin,
    OBJECT_OT_DfToggleVersions,
    OBJECT_OT_DfRefreshVersions,
    OBJECT_OT_DfRestoreQuick,
    OBJECT_OT_DfRenameVersion,
    OBJECT_OT_DfRefreshStatus,
    DF_PT_MainPanel
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)

def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register()
