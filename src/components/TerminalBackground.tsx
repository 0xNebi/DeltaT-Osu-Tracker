const TerminalBackground = () => {
  
  

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/40 backdrop-blur-[2px]">
        
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.1) 2px, rgba(0, 255, 255, 0.1) 4px)',
        }} />

        
        <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/20" />

        

        
        <div className="absolute inset-0 border border-cyan-500/10 pointer-events-none" style={{
          boxShadow: 'inset 0 0 100px rgba(6, 182, 212, 0.05)'
        }} />

        
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      </div>
    </div>
  );
};

export default TerminalBackground;
