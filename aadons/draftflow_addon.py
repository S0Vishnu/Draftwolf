bl_info = {
    "name": "DraftFlow Control",
    "author": "DraftFlow",
    "version": (1, 0),
    "blender": (2, 80, 0),
    "location": "View3D > Sidebar > DraftFlow",
    "description": "Version control for Blender with DraftFlow",
    "category": "Development",
}

import bpy
import json
import urllib.request
import urllib.error
import os
import subprocess
import sys

API_PORT = 45000
API_URL = f"http://127.0.0.1:{API_PORT}"

# --- Helper Functions ---

def send_request(endpoint, data=None):
    url = f"{API_URL}{endpoint}"
    req = urllib.request.Request(url)
    req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', 'DraftFlow-Blender/1.0')
    
    if data:
        jsondata = json.dumps(data).encode('utf-8')
        req.data = jsondata # IMPLIES POST
        
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"DraftFlow Connection Error: {e}")
        return None

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
    """Save a new version to DraftFlow"""
    bl_idname = "draftflow.commit"
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
            self.report({'ERROR'}, "DraftFlow project not found. Initialize it in the App.")
            return {'CANCELLED'}
            
        res = send_request('/draft/commit', {
            'projectRoot': root,
            'label': self.label_input,
            'files': [filepath]
        })
        
        if res and res.get('success'):
            self.report({'INFO'}, f"Version Saved! (ID: {res.get('versionId')})")
        else:
            self.report({'ERROR'}, "Failed to communicate with DraftFlow.")
            
        return {'FINISHED'}

    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self)


class OBJECT_OT_DfRetrieve(bpy.types.Operator):
    """Retrieve a previous version and open it"""
    bl_idname = "draftflow.retrieve"
    bl_label = "Retrieve Version"
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
        
        # Calculate relative path
        try:
            rel_path = os.path.relpath(filepath, root)
        except ValueError:
            self.report({'ERROR'}, "File is on a different drive than project root.")
            return {'CANCELLED'}

        # Request extraction to temp
        res = send_request('/draft/extract-temp', {
            'projectRoot': root,
            'versionId': version_id,
            'relativePath': rel_path.replace(os.sep, '/') # Normalize for JS
        })
        
        if res and res.get('success'):
            temp_path = res.get('path')
            
            # Launch new Blender instance
            # sys.argv[0] is often the blender executable in recent versions? 
            # Or bpy.app.binary_path
            blender_bin = bpy.app.binary_path
            
            self.report({'INFO'}, f"Opening stored version...")
            
            # Open new process
            subprocess.Popen([blender_bin, temp_path])
            
            # Close current session
            bpy.ops.wm.quit_blender()
        else:
            self.report({'ERROR'}, "Failed to retrieve version file.")

        return {'FINISHED'}

    def invoke(self, context, event):
        filepath = bpy.data.filepath
        if not filepath:
            self.report({'ERROR'}, "Save file first.")
            return {'CANCELLED'}
            
        root = get_project_root(filepath)
        if not root:
            self.report({'ERROR'}, "DraftFlow project not found.")
            return {'CANCELLED'}
            
        history = send_request('/draft/history', {'projectRoot': root})
        if history is None:
             self.report({'ERROR'}, "Could not connect to DraftFlow App.")
             return {'CANCELLED'}
             
        if not history:
            self.report({'WARNING'}, "No version history found.")
            return {'CANCELLED'}
            
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
    """Initialize DraftFlow in this directory"""
    bl_idname = "draftflow.init"
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
            self.report({'ERROR'}, "Failed to initialize project via App.")
            
        return {'FINISHED'}


class OBJECT_OT_DfOpenApp(bpy.types.Operator):
    """Open or Link to the DraftFlow App"""
    bl_idname = "draftflow.open_app"
    bl_label = "Open DraftFlow"

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
    bl_label = "DraftFlow"
    bl_idname = "DF_PT_MainPanel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'DraftFlow'

    def draw(self, context):
        layout = self.layout
        layout.use_property_split = True
        layout.use_property_decorate = False

        layout.label(text="Version Control")
        row = layout.row(align=True)
        row.scale_y = 1.5
        row.operator("draftflow.commit", icon="CHECKMARK")
        
        layout.separator()
        
        row = layout.row(align=True)
        row.scale_y = 1.2
        row.operator("draftflow.retrieve", icon="FILE_REFRESH")
        
        layout.separator()
        layout.label(text="Setup")
        layout.operator("draftflow.init", icon="FILE_NEW")
        
        layout.separator()
        layout.label(text="Application")
        layout.operator("draftflow.open_app", icon="WINDOW")


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
