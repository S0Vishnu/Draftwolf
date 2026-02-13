import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Environment, Grid } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';

// ─── Loaders ─────────────────────────────────────────────────────

function GLTFModel({ url }: { url: string }) {
    const { scene } = useGLTF(url);
    return (
        <Center>
            <primitive object={scene.clone()} />
        </Center>
    );
}

function OBJModel({ url }: { url: string }) {
    const [obj, setObj] = useState<THREE.Group | null>(null);

    useEffect(() => {
        const loader = new OBJLoader();
        loader.load(
            url,
            (loaded) => {
                // Apply default material if none
                loaded.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                            color: '#8b8b8b',
                            roughness: 0.5,
                            metalness: 0.3,
                        });
                    }
                });
                setObj(loaded);
            },
            undefined,
            (err) => console.error('[ModelDiff] OBJ load error:', err)
        );
    }, [url]);

    if (!obj) return null;
    return (
        <Center>
            <primitive object={obj} />
        </Center>
    );
}

// ─── Camera Sync ─────────────────────────────────────────────────

interface SyncState {
    position: THREE.Vector3;
    target: THREE.Vector3;
}

function SyncedControls({
    syncRef,
    isPrimary,
}: {
    syncRef: React.MutableRefObject<SyncState>;
    isPrimary: boolean;
}) {
    const controlsRef = useRef<any>(null);
    const { camera } = useThree();

    useFrame(() => {
        if (!controlsRef.current) return;

        if (isPrimary) {
            // Primary writes its state
            syncRef.current.position.copy(camera.position);
            syncRef.current.target.copy(controlsRef.current.target);
        } else {
            // Secondary reads and applies
            camera.position.copy(syncRef.current.position);
            controlsRef.current.target.copy(syncRef.current.target);
            controlsRef.current.update();
        }
    });

    return (
        <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.1}
            enabled={isPrimary}
        />
    );
}

// ─── Scene Wrapper ───────────────────────────────────────────────

function ModelScene({
    url,
    label,
    syncRef,
    isPrimary,
}: {
    url: string;
    label: string;
    syncRef: React.MutableRefObject<SyncState>;
    isPrimary: boolean;
}) {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    const isOBJ = ext === 'obj';

    return (
        <div className="diff-model-pane">
            <div className="diff-pane-label">{label}</div>
            <Canvas
                camera={{ position: [3, 2, 5], fov: 50 }}
                style={{ background: '#111218' }}
            >
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <Suspense fallback={null}>
                    {isOBJ ? <OBJModel url={url} /> : <GLTFModel url={url} />}
                    <Environment preset="studio" />
                </Suspense>
                <Grid
                    args={[20, 20]}
                    position={[0, -1, 0]}
                    cellColor="#222"
                    sectionColor="#333"
                    fadeDistance={20}
                    fadeStrength={1}
                />
                <SyncedControls syncRef={syncRef} isPrimary={isPrimary} />
            </Canvas>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────

interface ModelDiffProps {
    oldSrc: string;
    newSrc: string;
    oldLabel?: string;
    newLabel?: string;
}

const ModelDiff: React.FC<ModelDiffProps> = ({
    oldSrc,
    newSrc,
    oldLabel = 'Old',
    newLabel = 'New',
}) => {
    const syncRef = useRef<SyncState>({
        position: new THREE.Vector3(3, 2, 5),
        target: new THREE.Vector3(0, 0, 0),
    });

    return (
        <div className="diff-model-root">
            <div className="diff-model-hint">
                Rotate the left viewport — the right viewport follows automatically.
            </div>
            <div className="diff-model-split">
                <ModelScene
                    url={oldSrc}
                    label={oldLabel}
                    syncRef={syncRef}
                    isPrimary={true}
                />
                <div className="diff-model-divider" />
                <ModelScene
                    url={newSrc}
                    label={newLabel}
                    syncRef={syncRef}
                    isPrimary={false}
                />
            </div>
        </div>
    );
};

export default ModelDiff;
