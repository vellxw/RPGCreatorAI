/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0c] text-[#d1d1d1] font-mono select-none border-4 border-[#1c1c1e]">
      <header className="h-12 flex-shrink-0 border-b border-[#2d2d30] bg-[#141417] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#f27d26] shadow-[0_0_8px_rgba(242,125,38,0.5)]"></div>
          <span className="text-xs font-bold tracking-widest text-[#f0f0f0] uppercase">RPG_CREATOR_RUNTIME_V1.0_DEBUG <span className="ml-2 text-[10px] text-red-500 bg-red-500/20 px-1 py-0.5 rounded border border-red-500/50">PROTOTIPO TEMPORAL WEB</span></span>
        </div>
        <div className="flex gap-6 text-[10px] uppercase tracking-tighter opacity-70">
          <div>CPU: 2.4%</div>
          <div>MEM: 42MB</div>
          <div>FPS: 60.0</div>
          <div>SDL3_RENDERER: ACTIVE</div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-[#2d2d30] bg-[#0e0e11] flex flex-col">
          <div className="p-3 border-b border-[#2d2d30] bg-[#141417] text-[10px] uppercase font-bold text-[#8e9299]">Project Explorer</div>
          <div className="flex-1 p-2 space-y-1 overflow-hidden">
            <div className="flex items-center gap-2 text-xs py-1 px-2 bg-[#252529] rounded text-white">
              <span className="text-[#f27d26]">■</span> project.json
            </div>
            <div className="pl-4 space-y-1 mt-2">
              <div className="text-[#8e9299] text-[10px] uppercase mb-1">/maps</div>
              <div className="flex items-center gap-2 text-xs py-1 px-2 hover:bg-[#1c1c1f] cursor-pointer opacity-80 italic">town.json</div>
              <div className="flex items-center gap-2 text-xs py-1 px-2 hover:bg-[#1c1c1f] cursor-pointer opacity-80 italic">house.json</div>
              <div className="text-[#8e9299] text-[10px] uppercase mt-3 mb-1">/database</div>
              <div className="flex items-center gap-2 text-xs py-1 px-2 hover:bg-[#1c1c1f] cursor-pointer opacity-80 italic">items.json</div>
            </div>
          </div>
          <div className="p-3 bg-[#141417] border-t border-[#2d2d30]">
            <div className="text-[10px] uppercase text-[#8e9299] mb-2">Flags & Switches</div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>talked_to_old_man</span>
                <span className="text-green-500">TRUE</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>chest_001_opened</span>
                <span className="text-red-500">FALSE</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>town_bridge_open</span>
                <span className="text-red-500">FALSE</span>
              </div>
            </div>
          </div>
        </aside>
        <section className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
          <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:32px_32px]">
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 p-2 text-[10px] space-y-1">
              <div className="text-[#f27d26] underline">RUNTIME_INFO</div>
              <div>MAP_ID: town</div>
              <div>PLAYER: 08, 06</div>
              <div>DIR: down</div>
            </div>
            <div className="w-[512px] h-[384px] bg-[#1a1a1c] border-2 border-[#333] shadow-2xl relative">
              <div className="absolute inset-0 grid grid-cols-[repeat(16,minmax(0,1fr))] grid-rows-[repeat(12,minmax(0,1fr))] border border-[#222]">
                <div className="col-start-9 row-start-7 w-8 h-8 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)] flex items-center justify-center text-[10px] text-black font-bold">P</div>
                <div className="col-start-11 row-start-6 w-8 h-8 bg-purple-600 border border-purple-400 flex items-center justify-center text-[10px] text-white">NPC</div>
                <div className="col-start-14 row-start-10 w-8 h-8 bg-amber-600 border border-amber-400 flex items-center justify-center text-[10px] text-white italic">C</div>
                <div className="col-start-3 row-start-2 w-8 h-8 bg-green-900/50 border border-green-700/30"></div>
                <div className="col-start-4 row-start-2 w-8 h-8 bg-green-900/50 border border-green-700/30"></div>
                <div className="col-start-1 row-start-1 w-full h-full border border-white/5 pointer-events-none"></div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 h-24 bg-[#0c0c0e] border-2 border-[#f27d26] p-4 flex flex-col justify-between shadow-lg">
                <div className="text-[#f27d26] text-[10px] uppercase tracking-widest font-bold">Anciano</div>
                <div className="text-sm text-white leading-tight italic">"No cruces el puente de noche. Las sombras de este valle no son amigables con los extraños."</div>
                <div className="text-[8px] self-end animate-pulse opacity-60">PRESS [ENTER] TO CONTINUE</div>
              </div>
            </div>
          </div>
          <div className="h-48 flex-shrink-0 border-t border-[#2d2d30] bg-[#0c0c0e] flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#8e9299] font-bold tracking-widest uppercase">Output Console</span>
              <span className="text-[9px] opacity-40">FILTER: ALL_MESSAGES</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 text-[11px] leading-none">
              <div className="text-blue-400">[INFO] Initializing RPG Creator Runtime...</div>
              <div className="text-blue-400">[INFO] Loading project: "Demo RPG" (schema v1)</div>
              <div className="text-green-400">[SUCCESS] Project loaded. Map count: 2. Database: OK.</div>
              <div className="text-blue-400">[INFO] MapScene changed to "town"</div>
              <div className="text-gray-500 italic">[INPUT] KeyDown: ArrowRight</div>
              <div className="text-gray-500 italic">[INPUT] KeyDown: ArrowDown</div>
              <div className="text-yellow-400">[EXEC] Triggering event "old_man" at (10, 6) via interact</div>
              <div className="text-cyan-400 font-bold">[EVENT] Executing command: showText("Anciano", "No cruces...")</div>
              <div className="text-purple-400">[STATE] SetFlag "talked_to_old_man" = true</div>
              <div className="text-green-400">[FS] SaveManager: Automatic checkpoint written to saves/slot_1.json</div>
            </div>
          </div>
        </section>
        <aside className="w-72 border-l border-[#2d2d30] bg-[#0e0e11] p-4 flex flex-col gap-4">
          <div className="border border-[#2d2d30] bg-[#141417] p-3 rounded-md">
            <div className="text-[10px] text-[#f27d26] mb-2 uppercase font-bold tracking-widest">Inventory</div>
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs py-1 px-2 bg-white/5 rounded">
                <span className="text-white opacity-80">Potion</span>
                <span className="text-[#f27d26]">x2</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1 px-2 bg-white/5 rounded">
                <span className="text-white opacity-80">Iron Key</span>
                <span className="text-[#f27d26]">x1</span>
              </div>
            </div>
          </div>
          <div className="border border-[#2d2d30] bg-[#141417] p-3 rounded-md flex-1">
            <div className="text-[10px] text-[#f27d26] mb-2 uppercase font-bold tracking-widest">Data Inspector</div>
            <div className="font-mono text-[9px] text-[#8e9299] space-y-1 overflow-hidden h-full">
              <p className="text-blue-300">// Event Runner Queue</p>
              <p>{"{ \"type\": \"setFlag\","}</p>
              <p>&nbsp;&nbsp;{"\"flag\": \"talked_man\","}</p>
              <p>&nbsp;&nbsp;{"\"val\": true }"}</p>
              <p className="mt-4 text-blue-300">// Active Collisions</p>
              <p>[SOLID] 04,02 (Tree)</p>
              <p>[SOLID] 10,05 (Chest)</p>
              <p>[NPC] 10,06 (OldMan)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <button className="bg-[#252529] py-2 cursor-pointer text-[10px] uppercase font-bold text-white border border-white/10 hover:bg-[#333]">F5: SAVE</button>
            <button className="bg-[#252529] py-2 cursor-pointer text-[10px] uppercase font-bold text-white border border-white/10 hover:bg-[#333]">F9: LOAD</button>
          </div>
        </aside>
      </main>
      <footer className="h-6 flex-shrink-0 bg-[#f27d26] text-black flex items-center px-4 justify-between font-bold text-[9px] uppercase tracking-widest">
        <div>RUNTIME STATUS: RUNNING (PID 8492)</div>
        <div>PHASE 1 - CORE ARCHITECTURE VALIDATED</div>
      </footer>
    </div>
  );
}
