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
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"DraftWolf API Error: {e.code}")
        try:
            err_body = e.read().decode('utf-8')
            return json.loads(err_body)
        except:
            return {'success': False, 'error': f"HTTP {e.code}"}
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"DraftWolf Connection Error: {e}")
        return {'success': False, 'error': str(e)}

def get_project_root(filepath):
    if not filepath:
        return None
    # We send the directory so find-root can traverse up
    res = send_request('/draft/find-root', {'path': os.path.dirname(filepath)})
    return res.get('root') if res else None

# --- Global State for UI ---
class SafeVersionList:
    items = []

# --- Operators ---

class OBJECT_OT_DfCommit(bpy.types.Operator):
    """Save a new version to DraftWolf"""
    bl_idname = "draftwolf.commit"
    bl_label = "Save Version"
    bl_options = {'REGISTER', 'UNDO'}
    
    label_input: bpy.props.StringProperty(name="Label", default="New Version")

    def execute(self, context):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'ERROR'}, "Please save the Blender file locally first.")
            return {'CANCELLED'}
        
        # Force save to disk so we version the latest changes
        bpy.ops.wm.save_mainfile()
        
        root = get_project_root(filepath)
        if not root:
            self.report({'ERROR'}, "DraftWolf project not found. Initialize it in the App.")
            return {'CANCELLED'}
            
        res = send_request('/draft/commit', {
            'projectRoot': root,
            'label': self.label_input,
            'files': [filepath]
        })
        
        if res and res.get('success'):
            self.report({'INFO'}, f"Version Saved! (ID: {res.get('versionId')})")
        else:
            err = res.get('error', 'Unknown Error') if res else "Connection Error"
            self.report({'ERROR'}, f"Msg: {err}")
            
        return {'FINISHED'}

    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self)


class OBJECT_OT_DfRetrieve(bpy.types.Operator):
    """Restore a previous version (Overwrites current file)"""
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
            self.report({'ERROR'}, "Save file first.")
            return {'CANCELLED'}
            
        root = get_project_root(filepath)
        if not root:
            self.report({'ERROR'}, "DraftWolf project not found.")
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
            SafeVersionList.items.append((vid, display_name, f"ID: {vid}"))
            
        return context.window_manager.invoke_props_dialog(self)



class OBJECT_OT_DfInit(bpy.types.Operator):
    """Initialize DraftWolf in this directory"""
    bl_idname = "draftwolf.init"
    bl_label = "Initialize Project"
    bl_options = {'REGISTER'}

    def execute(self, context):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'ERROR'}, "Save file first.")
            return {'CANCELLED'}
            
        directory = os.path.dirname(filepath)
        
        res = send_request('/draft/init', {'projectRoot': directory})
        if res and res.get('success'):
            self.report({'INFO'}, "Project Initialized!")
        else:
            err = res.get('error', 'Unknown Error') if res else "Connection Error"
            self.report({'ERROR'}, f"Init Failed: {err}")
            
        return {'FINISHED'}


class OBJECT_OT_DfOpenApp(bpy.types.Operator):
    """Open or Link to the DraftWolf App"""
    bl_idname = "draftwolf.open_app"
    bl_label = "Open DraftWolf"

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

        layout.label(text="Version Control")
        row = layout.row(align=True)
        row.scale_y = 1.5
        row.operator("draftwolf.commit", icon="CHECKMARK")
        
        layout.separator()
        
        row = layout.row(align=True)
        row.scale_y = 1.2
        row.operator("draftwolf.retrieve", icon="FILE_REFRESH")
        
        layout.separator()
        layout.label(text="Setup")
        layout.operator("draftwolf.init", icon="FILE_NEW")
        
        layout.separator()
        layout.label(text="Application")
        layout.operator("draftwolf.open_app", icon="WINDOW")


# --- Registration ---

classes = (
    OBJECT_OT_DfCommit,
    OBJECT_OT_DfRetrieve,
    OBJECT_OT_DfInit,
    OBJECT_OT_DfOpenApp,
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
