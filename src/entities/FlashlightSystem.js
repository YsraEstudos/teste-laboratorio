import * as THREE from 'three';

export class FlashlightSystem {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;
    this.equipped = true; // Por padrão já está disponível e equipada no inventário

    // Grupo raiz da lanterna
    this.group = new THREE.Group();

    // SpotLight de alto desempenho
    this.spotLight = new THREE.SpotLight(0xfff5e0, 7.5, 35, Math.PI / 5.5, 0.4, 1.8);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.width = 1048;
    this.spotLight.shadow.mapSize.height = 1048;
    this.spotLight.shadow.bias = -0.0001;
    this.spotLight.shadow.normalBias = 0.02;
    this.spotLight.shadow.camera.near = 0.2;
    this.spotLight.shadow.camera.far = 38;

    this.target = new THREE.Object3D();
    this.spotLight.target = this.target;

    this.group.add(this.spotLight);
    this.group.add(this.target);

    // Mesh Volumétrico para Simular Facho de Luz em Névoa/Poeira
    const coneLength = 26;
    const coneRadius = Math.tan(Math.PI / 5.5) * coneLength;
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneLength, 32, 1, true);
    coneGeo.translate(0, -coneLength / 2, 0);
    coneGeo.rotateX(-Math.PI / 2);

    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfffaed,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.beamMesh = new THREE.Mesh(coneGeo, this.beamMaterial);
    this.group.add(this.beamMesh);

    // Inicialmente desativada
    this.group.visible = false;
    this.scene.add(this.group);
  }

  toggle() {
    if (!this.equipped) return false;
    this.enabled = !this.enabled;
    this.group.visible = this.enabled;
    return this.enabled;
  }

  setEquipped(equipped) {
    this.equipped = equipped;
    if (!this.equipped) {
      this.enabled = false;
      this.group.visible = false;
    }
  }

  setEnabled(enabled) {
    if (!this.equipped) return;
    this.enabled = enabled;
    this.group.visible = this.enabled;
  }

  /**
   * Atualiza a posição e direção da lanterna com base na posição do jogador e ângulo de visão/direção do mouse.
   * @param {THREE.Vector3} playerPos Posição do jogador
   * @param {THREE.Vector3} targetDir Vetor de direção da visada (normalizado)
   */
  update(playerPos, targetDir) {
    if (!this.enabled || !playerPos) return;

    // Posiciona na altura do peito do personagem (Y = 1.45)
    const origin = playerPos.clone();
    origin.y += 1.45;

    this.spotLight.position.copy(origin);
    this.beamMesh.position.copy(origin);

    // Ajusta o destino do SpotLight
    const forward =
      targetDir && targetDir.lengthSq() > 0.001 ? targetDir.clone().normalize() : new THREE.Vector3(0, 0, -1);

    const dest = origin.clone().add(forward.clone().multiplyScalar(20));
    this.target.position.copy(dest);

    // Orienta o cone volumétrico para o destino
    this.beamMesh.lookAt(dest);
  }

  dispose() {
    this.scene.remove(this.group);
    this.spotLight.dispose();
    if (this.beamMesh.geometry) this.beamMesh.geometry.dispose();
    if (this.beamMaterial) this.beamMaterial.dispose();
  }
}
