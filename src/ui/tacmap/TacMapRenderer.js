/**
 * TacMapRenderer handles Canvas 2D drawing routines for the tactical map.
 * Pre-allocates object containers to eliminate per-frame object creation.
 */
export class TacMapRenderer {
  constructor() {
    // Reusable cached objects to prevent per-frame garbage collection
    this._bounds = { x: 0, y: 0, w: 0, h: 0 };
    this._childPoint = { cx: 0, cy: 0 };
    this._playerPoint = { cx: 0, cy: 0 };
  }

  /**
   * Main render call.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   * @param {TacMapLayout} layout
   * @param {Object} game
   * @param {Object|null} hoveredRoom
   * @param {number} time
   */
  render(ctx, canvas, layout, game, hoveredRoom, time) {
    const width = canvas.width;
    const height = canvas.height;

    // Clear Canvas & Background Grid
    ctx.fillStyle = '#0a1017';
    ctx.fillRect(0, 0, width, height);

    this.drawGrid(ctx, width, height);
    this.drawRadarSweep(ctx, width, height, time);
    this.drawCorridors(ctx, layout, width, height);
    this.drawRooms(ctx, layout, width, height, hoveredRoom);
    this.drawEntities(ctx, layout, width, height, game, time);
  }

  /**
   * Draws tactical grid lines.
   */
  drawGrid(ctx, width, height) {
    ctx.strokeStyle = 'rgba(73, 215, 232, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 30) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 30) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  /**
   * Draws a animated radar sweep effect.
   */
  drawRadarSweep(ctx, width, height, time) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(width, height);
    const angle = (time * 1.2) % (Math.PI * 2);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Sweep cone
    ctx.fillStyle = 'rgba(73, 215, 232, 0.04)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -0.3, 0);
    ctx.closePath();
    ctx.fill();

    // Leading sweep line
    ctx.strokeStyle = 'rgba(73, 215, 232, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius, 0);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws corridor connecting paths.
   */
  drawCorridors(ctx, layout, width, height) {
    ctx.fillStyle = 'rgba(30, 50, 65, 0.7)';
    ctx.strokeStyle = 'rgba(73, 215, 232, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < layout.corridors.length; i++) {
      const corr = layout.corridors[i];
      const b = layout.getRoomCanvasBounds(corr, width, height, this._bounds);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }

  /**
   * Draws lab rooms with hover highlighting and labels.
   */
  drawRooms(ctx, layout, width, height, hoveredRoom) {
    for (let i = 0; i < layout.rooms.length; i++) {
      const room = layout.rooms[i];
      const b = layout.getRoomCanvasBounds(room, width, height, this._bounds);
      const isHovered = hoveredRoom === room;

      // Fill
      ctx.fillStyle = isHovered ? 'rgba(73, 215, 232, 0.28)' : 'rgba(16, 28, 38, 0.85)';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Border
      ctx.strokeStyle = isHovered ? '#ffffff' : room.color || '#49d7e8';
      ctx.lineWidth = isHovered ? 4 : 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      if (isHovered) {
        ctx.shadowColor = '#49d7e8';
        ctx.shadowBlur = 15;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
        ctx.shadowBlur = 0;
      }

      // Room Title Font
      let fontSize = isHovered ? 20 : 13;
      const fontStyle = isHovered ? '700' : '600';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isHovered ? '#ffffff' : room.color || '#a9f0ff';
      ctx.font = `${fontStyle} ${fontSize}px Rajdhani, Arial, sans-serif`;
      const maxTitleWidth = Math.max(8, b.w - 4);
      while (fontSize > 8 && ctx.measureText(room.name).width > maxTitleWidth) {
        fontSize -= 1;
        ctx.font = `${fontStyle} ${fontSize}px Rajdhani, Arial, sans-serif`;
      }

      ctx.fillText(room.name, b.x + b.w / 2, b.y + b.h / 2);
    }
  }

  /**
   * Draws real-time entity markers (Wind Child and Player).
   */
  drawEntities(ctx, layout, width, height, game, time) {
    // 1. Wind Child Marker (Emerald/Gold Swirl)
    if (game.windChild) {
      const childPos = game.windChild.position;
      const c = layout.worldToCanvas(childPos.x, childPos.z, width, height, this._childPoint);

      const pulse = 1 + Math.sin(time * 6) * 0.15;

      ctx.save();
      ctx.translate(c.cx, c.cy);

      // Rotating Aura Ring
      ctx.strokeStyle = '#54f08c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#54f08c';
      ctx.shadowColor = '#54f08c';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.font = '700 12px Rajdhani, Arial, sans-serif';
      ctx.fillStyle = '#54f08c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WIND CHILD', 0, 26);

      ctx.restore();
    }

    // 2. Player Marker (Cyan Pulsing Dot + Direction Cone)
    if (game.player) {
      const playerPos = game.player.position;
      const p = layout.worldToCanvas(playerPos.x, playerPos.z, width, height, this._playerPoint);
      const rotY = game.player.model ? game.player.model.rotation.y : 0;

      ctx.save();
      ctx.translate(p.cx, p.cy);

      // Directional Cone
      ctx.fillStyle = 'rgba(73, 215, 232, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 24, rotY - Math.PI / 2 - 0.4, rotY - Math.PI / 2 + 0.4);
      ctx.closePath();
      ctx.fill();

      // Core Marker
      ctx.fillStyle = '#49d7e8';
      ctx.shadowColor = '#49d7e8';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label
      ctx.font = '700 13px Rajdhani, Arial, sans-serif';
      ctx.fillStyle = '#49d7e8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VOCÊ (JOGADOR)', 0, -18);

      ctx.restore();
    }
  }
}
