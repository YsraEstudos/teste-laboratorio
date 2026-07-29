import React from 'react';
import { useGameStore } from '../useGameStore.js';
import { gameStore } from '../../state/gameStore.js';

export function HUD() {
  const {
    happiness,
    energy,
    powerLevel,
    roomName,
    isTargeting,
    inventoryOpen,
    isFlashlightEquipped,
    isFlashlightOn,
    items = [],
  } = useGameStore();

  const toggleInventory = () => {
    gameStore.setState({ inventoryOpen: !inventoryOpen });
  };

  const toggleFlashlightEquip = () => {
    const nextEquipped = !isFlashlightEquipped;
    gameStore.setState({
      isFlashlightEquipped: nextEquipped,
      isFlashlightOn: nextEquipped ? isFlashlightOn : false,
    });
  };

  const toggleFlashlightPower = () => {
    if (!isFlashlightEquipped) return;
    gameStore.setState({ isFlashlightOn: !isFlashlightOn });
  };

  return (
    <div className="react-hud-container" style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
      {/* Top Center Room Badge */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 43, 62, 0.85)',
          border: '1px solid #00f0ff',
          borderRadius: '20px',
          padding: '6px 24px',
          color: '#76f5ff',
          fontFamily: 'Rajdhani, sans-serif',
          fontWeight: 700,
          letterSpacing: '1.5px',
          boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)',
        }}
      >
        {roomName || 'SALA DE TESTES'}
      </div>

      {/* Top Right Quick Controls Badge */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '25px',
          display: 'flex',
          gap: '10px',
          pointerEvents: 'auto',
        }}
      >
        <button
          onClick={toggleInventory}
          style={{
            backgroundColor: inventoryOpen ? 'rgba(0, 240, 255, 0.9)' : 'rgba(15, 43, 62, 0.85)',
            color: inventoryOpen ? '#020810' : '#00f0ff',
            border: '1px solid #00f0ff',
            borderRadius: '12px',
            padding: '8px 16px',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)',
            transition: 'all 0.2s',
          }}
        >
          🎒 INVENTÁRIO [I]
        </button>

        <button
          onClick={toggleFlashlightPower}
          disabled={!isFlashlightEquipped}
          style={{
            backgroundColor: isFlashlightOn ? 'rgba(255, 230, 100, 0.9)' : 'rgba(15, 43, 62, 0.85)',
            color: isFlashlightOn ? '#020810' : isFlashlightEquipped ? '#ffea78' : '#777',
            border: `1px solid ${isFlashlightOn ? '#ffea78' : '#666'}`,
            borderRadius: '12px',
            padding: '8px 16px',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 700,
            cursor: isFlashlightEquipped ? 'pointer' : 'not-allowed',
            opacity: isFlashlightEquipped ? 1 : 0.6,
            transition: 'all 0.2s',
          }}
        >
          🔦 LANTERNA {isFlashlightOn ? '[ON]' : '[OFF]'} [F]
        </button>
      </div>

      {/* Target Prompt indicator when in targeting mode */}
      {isTargeting && (
        <div
          style={{
            position: 'absolute',
            top: '65px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 240, 255, 0.9)',
            color: '#020810',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 700,
            padding: '4px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            animation: 'pulse 1s infinite alternate',
          }}
        >
          🎯 CLIQUE EM UM OBJETO PARA FOCAR O PODER!
        </div>
      )}

      {/* Inventory Modal Overlay */}
      {inventoryOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(2, 8, 16, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: '560px',
              backgroundColor: 'rgba(10, 25, 40, 0.95)',
              border: '2px solid #00f0ff',
              borderRadius: '16px',
              padding: '24px',
              color: '#fff',
              fontFamily: 'Rajdhani, sans-serif',
              boxShadow: '0 0 35px rgba(0, 240, 255, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,240,255,0.3)', paddingBottom: '12px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#00f0ff', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎒 INVENTÁRIO TÁTICO DE EQUIPAMENTOS
              </div>
              <button
                onClick={toggleInventory}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#00f0ff',
                  fontSize: '22px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Items Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(0, 240, 255, 0.05)',
                    border: '1px solid rgba(0, 240, 255, 0.4)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      style={{
                        fontSize: '36px',
                        backgroundColor: 'rgba(0, 240, 255, 0.15)',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #00f0ff',
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{item.name}</div>
                      <div style={{ fontSize: '13px', color: '#89cff0', marginTop: '2px', maxWidth: '280px' }}>{item.description}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <button
                      onClick={toggleFlashlightEquip}
                      style={{
                        backgroundColor: isFlashlightEquipped ? '#00f0ff' : 'rgba(255,255,255,0.1)',
                        color: isFlashlightEquipped ? '#020810' : '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isFlashlightEquipped ? 'EQUIPADO ✔' : 'EQUIPAR'}
                    </button>

                    {isFlashlightEquipped && (
                      <button
                        onClick={toggleFlashlightPower}
                        style={{
                          backgroundColor: isFlashlightOn ? '#ffeb3b' : 'rgba(0, 240, 255, 0.2)',
                          color: isFlashlightOn ? '#000' : '#00f0ff',
                          border: '1px solid #ffeb3b',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isFlashlightOn ? '💡 LIGADA' : '🔌 DESLIGADA'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer info */}
            <div style={{ fontSize: '12px', color: '#76f5ff', textAlign: 'center', marginTop: '8px', borderTop: '1px dashed rgba(0,240,255,0.2)', paddingTop: '10px' }}>
              💡 Pressione a tecla <strong style={{ color: '#fff' }}>[I]</strong> para fechar ou <strong style={{ color: '#fff' }}>[F]</strong> para alternar a lanterna a qualquer momento no jogo.
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '25px',
          left: '25px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: 'rgba(10, 20, 32, 0.85)',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          borderRadius: '12px',
          padding: '12px 18px',
          color: '#fff',
          fontFamily: 'Rajdhani, sans-serif',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#76f5ff', fontWeight: 600 }}>ENERGIA:</span>
          <div style={{ width: '120px', height: '10px', backgroundColor: '#1a2b3c', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{ width: `${energy}%`, height: '100%', backgroundColor: '#00f0ff', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>{energy}%</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#ffb74d', fontWeight: 600 }}>FELICIDADE:</span>
          <div style={{ width: '120px', height: '10px', backgroundColor: '#1a2b3c', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{ width: `${happiness}%`, height: '100%', backgroundColor: '#ffb74d', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>{happiness}%</span>
        </div>

        <div style={{ fontSize: '13px', color: '#a1fcff', fontWeight: 700, marginTop: '2px' }}>
          NÍVEL DE PODER: <span style={{ color: '#00f0ff', fontSize: '15px' }}>{powerLevel} / 10</span>
        </div>
      </div>
    </div>
  );
}
