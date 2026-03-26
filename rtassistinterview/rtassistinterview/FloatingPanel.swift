//
//  FloatingPanel.swift
//  rtassistinterview
//
//  NSPanel personalizado para ventana flotante
//

import SwiftUI
import AppKit

// MARK: - NSPanel Personalizado
class FloatingPanel<Content: View>: NSPanel {
    @Binding var isPresented: Bool
    
    init(view: () -> Content,
         contentRect: NSRect = CGRect(x: 0, y: 0, width: 500, height: 120),
         isPresented: Binding<Bool>) {
        self._isPresented = isPresented
        
        super.init(contentRect: contentRect,
                   styleMask: [.nonactivatingPanel, .fullSizeContentView, .borderless],
                   backing: .buffered,
                   defer: false)
        
        configurePanel()
        
        contentView = NSHostingView(
            rootView: view()
                .ignoresSafeArea()
                .environment(\.floatingPanel, self)
        )
    }
    
    private func configurePanel() {
        isFloatingPanel = true
        level = .floating
        hidesOnDeactivate = false  // No se cierra al hacer clic fuera
        
        titleVisibility = .hidden
        titlebarAppearsTransparent = true
        
        standardWindowButton(.closeButton)?.isHidden = true
        standardWindowButton(.miniaturizeButton)?.isHidden = true
        standardWindowButton(.zoomButton)?.isHidden = true
        
        backgroundColor = .clear
        isOpaque = false
        hasShadow = true
        
        animationBehavior = .alertPanel
        isMovableByWindowBackground = true
        
        becomesKeyOnlyIfNeeded = false
    }
    
    override func close() {
        super.close()
        isPresented = false
    }
    
    override var canBecomeKey: Bool { 
        get { false }
        set { }
    }
}

// MARK: - Environment Key
private struct FloatingPanelKey: EnvironmentKey {
    static let defaultValue: NSPanel? = nil
}

extension EnvironmentValues {
    var floatingPanel: NSPanel? {
        get { self[FloatingPanelKey.self] }
        set { self[FloatingPanelKey.self] = newValue }
    }
}
