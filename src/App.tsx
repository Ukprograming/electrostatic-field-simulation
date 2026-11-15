import { useState, useCallback, useRef } from 'react';
import {
  PointCharge,
  ChargeColumn,
  SimulationModel,
  FieldDisplayMode,
  PRESET_SCENARIOS,
  UNIFORM_PRESET_SCENARIOS,
} from './physics/electrostatics';
import { ElectricField3DCanvas } from './components/ElectricField3DCanvas';
import { ControlDeck } from './components/ControlDeck';

function createInitialCharges(presetId: string): PointCharge[] {
  const preset =
    PRESET_SCENARIOS.find((p) => p.id === presetId) ?? PRESET_SCENARIOS[0];
  return preset.charges.map((c, index) => ({
    id: `charge-${preset.id}-${index}-${Date.now()}`,
    x: c.x,
    y: c.y,
    q: c.q,
  }));
}

function createInitialColumns(presetId: string): ChargeColumn[] {
  const preset =
    UNIFORM_PRESET_SCENARIOS.find((p) => p.id === presetId) ??
    UNIFORM_PRESET_SCENARIOS[0];
  return preset.columns.map((c, index) => ({
    id: `column-${preset.id}-${index}-${Date.now()}`,
    x: c.x,
    q: c.q,
  }));
}

export default function App() {
  const nextIdCounter = useRef(1);
  const [simulationModel, setSimulationModel] =
    useState<SimulationModel>('point');

  const [activePresetId, setActivePresetId] = useState<string>('single');
  const [charges, setCharges] = useState<PointCharge[]>(() =>
    createInitialCharges('single')
  );
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(
    () => charges[0]?.id ?? null
  );

  const [activeUniformPresetId, setActiveUniformPresetId] =
    useState<string>('capacitor');
  const [columns, setColumns] = useState<ChargeColumn[]>(() =>
    createInitialColumns('capacitor')
  );
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(
    () => columns[0]?.id ?? null
  );

  const activeSelectedId =
    selectedChargeId && charges.some((c) => c.id === selectedChargeId)
      ? selectedChargeId
      : null;

  const activeSelectedColumnId =
    selectedColumnId && columns.some((c) => c.id === selectedColumnId)
      ? selectedColumnId
      : null;

  const [fieldMode, setFieldMode] = useState<FieldDisplayMode>('none');
  const [showEquipotentials, setShowEquipotentials] = useState<boolean>(false);
  const [showPotentialTint, setShowPotentialTint] = useState<boolean>(false);
  const [snapToInteger, setSnapToInteger] = useState<boolean>(false);

  const handleLoadPreset = useCallback(
    (presetId: string) => {
      if (simulationModel === 'uniform') {
        const newCols = createInitialColumns(presetId);
        setActiveUniformPresetId(presetId);
        setColumns(newCols);
        setSelectedColumnId(newCols[0]?.id ?? null);
      } else {
        const newCharges = createInitialCharges(presetId);
        setActivePresetId(presetId);
        setCharges(newCharges);
        setSelectedChargeId(newCharges[0]?.id ?? null);
      }
    },
    [simulationModel]
  );

  const handleReset = useCallback(() => {
    if (simulationModel === 'uniform') {
      handleLoadPreset(activeUniformPresetId);
    } else {
      handleLoadPreset(activePresetId);
    }
  }, [simulationModel, activePresetId, activeUniformPresetId, handleLoadPreset]);

  const handleMoveCharge = useCallback((id: string, x: number, y: number) => {
    setCharges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, x, y } : c))
    );
  }, []);

  const handleQuickAddCharge = useCallback(
    (q: number) => {
      const candidateSpots: Array<[number, number]> = [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [0, 0],
        [-3, 1],
        [3, -1],
      ];
      let chosen: [number, number] = [
        Math.round((Math.random() - 0.5) * 4),
        Math.round((Math.random() - 0.5) * 4),
      ];
      for (const [cx, cy] of candidateSpots) {
        const occupied = charges.some(
          (c) => Math.hypot(c.x - cx, c.y - cy) < 0.75
        );
        if (!occupied) {
          chosen = [cx, cy];
          break;
        }
      }
      const id = `charge-user-${nextIdCounter.current++}`;
      setCharges((prev) => [...prev, { id, x: chosen[0], y: chosen[1], q }]);
      setSelectedChargeId(id);
    },
    [charges]
  );

  const handleUpdateChargeQ = useCallback((id: string, q: number) => {
    const clamped = Math.max(-5, Math.min(5, Math.round(q * 2) / 2));
    setCharges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, q: clamped } : c))
    );
  }, []);

  const handleDeleteCharge = useCallback((id: string) => {
    setCharges((prev) => prev.filter((c) => c.id !== id));
    setSelectedChargeId((prevSel) => (prevSel === id ? null : prevSel));
  }, []);

  const handleClearAllCharges = useCallback(() => {
    setCharges([]);
    setSelectedChargeId(null);
  }, []);

  const handleMoveColumn = useCallback((id: string, x: number) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, x } : col))
    );
  }, []);

  const handleQuickAddColumn = useCallback(
    (q: number) => {
      const candidateX = [0, 2, -2, 4, -4, 6, -6, 8, -8];
      let chosenX = Math.round((Math.random() - 0.5) * 8);
      for (const cx of candidateX) {
        const occupied = columns.some((col) => Math.abs(col.x - cx) < 0.75);
        if (!occupied) {
          chosenX = cx;
          break;
        }
      }
      const id = `column-user-${nextIdCounter.current++}`;
      setColumns((prev) => [...prev, { id, x: chosenX, q }]);
      setSelectedColumnId(id);
    },
    [columns]
  );

  const handleUpdateColumnQ = useCallback(
    (id: string, q: number) => {
      const clamped = Math.max(-5, Math.min(5, Math.round(q * 2) / 2));
      const normalized = clamped === 0 ? 0 : clamped;
      const opposite = normalized === 0 ? 0 : -normalized;
      setColumns((prev) => {
        const linkCapacitor =
          activeUniformPresetId === 'capacitor' && prev.length === 2;
        return prev.map((col) => {
          if (col.id === id) return { ...col, q: normalized };
          if (linkCapacitor) return { ...col, q: opposite };
          return col;
        });
      });
    },
    [activeUniformPresetId]
  );

  const handleDeleteColumn = useCallback((id: string) => {
    setColumns((prev) => prev.filter((col) => col.id !== id));
    setSelectedColumnId((prevSel) => (prevSel === id ? null : prevSel));
  }, []);

  const handleClearAllColumns = useCallback(() => {
    setColumns([]);
    setSelectedColumnId(null);
  }, []);

  const currentPresets =
    simulationModel === 'uniform' ? UNIFORM_PRESET_SCENARIOS : PRESET_SCENARIOS;
  const currentPresetId =
    simulationModel === 'uniform' ? activeUniformPresetId : activePresetId;

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col bg-slate-50 text-slate-900">
      {/* Three-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 shrink-0 flex items-center justify-between gap-8">
        <h1 className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          静電場ラボ
        </h1>

        <nav
          aria-label="プリセット"
          className="hidden md:flex items-center gap-6 overflow-x-auto"
        >
          {currentPresets.map((preset) => {
            const isActive = preset.id === currentPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadPreset(preset.id)}
                className={`py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                  isActive
                    ? 'text-slate-900 border-slate-900'
                    : 'text-slate-500 border-transparent hover:text-slate-900'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 min-h-[38px] text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            リセット
          </button>
        </div>
      </header>

      {/* Mobile / Portrait iPad Preset Strip */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-1.5 flex items-center gap-5 overflow-x-auto shrink-0">
        {currentPresets.map((preset) => {
          const isActive = preset.id === currentPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleLoadPreset(preset.id)}
              className={`py-1.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                isActive
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-500 border-transparent'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Two-Zone Sandbox Workspace (Portrait iPad stacks cleanly, Landscape iPad & Desktop side-by-side) */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="h-[56dvh] min-h-[380px] lg:h-auto lg:flex-1 lg:min-h-0 relative">
          <ElectricField3DCanvas
            simulationModel={simulationModel}
            charges={charges}
            selectedChargeId={activeSelectedId}
            columns={columns}
            selectedColumnId={activeSelectedColumnId}
            fieldMode={fieldMode}
            showEquipotentials={showEquipotentials}
            showPotentialTint={showPotentialTint}
            snapToInteger={snapToInteger}
            onSelectCharge={setSelectedChargeId}
            onMoveCharge={handleMoveCharge}
            onSelectColumn={setSelectedColumnId}
            onMoveColumn={handleMoveColumn}
          />
        </div>

        <ControlDeck
          simulationModel={simulationModel}
          isCapacitorMode={
            simulationModel === 'uniform' &&
            activeUniformPresetId === 'capacitor' &&
            columns.length === 2
          }
          charges={charges}
          selectedChargeId={activeSelectedId}
          columns={columns}
          selectedColumnId={activeSelectedColumnId}
          fieldMode={fieldMode}
          showEquipotentials={showEquipotentials}
          showPotentialTint={showPotentialTint}
          snapToInteger={snapToInteger}
          onSimulationModelChange={setSimulationModel}
          onFieldModeChange={setFieldMode}
          onToggleEquipotentials={() => setShowEquipotentials((v) => !v)}
          onTogglePotentialTint={() => setShowPotentialTint((v) => !v)}
          onToggleSnap={() => setSnapToInteger((v) => !v)}
          onQuickAddCharge={handleQuickAddCharge}
          onUpdateChargeQ={handleUpdateChargeQ}
          onDeleteCharge={handleDeleteCharge}
          onClearAllCharges={handleClearAllCharges}
          onQuickAddColumn={handleQuickAddColumn}
          onUpdateColumnQ={handleUpdateColumnQ}
          onDeleteColumn={handleDeleteColumn}
          onClearAllColumns={handleClearAllColumns}
        />
      </main>
    </div>
  );
}

