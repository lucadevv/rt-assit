//
//  rtassistinterviewApp.swift
//  rtassistinterview
//
//  Entry point de la aplicación macOS
//

import SwiftUI

@main
struct rtassistinterviewApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 450, minHeight: 450)
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Configurar apariencia oscura
        NSApp.appearance = NSAppearance(named: .darkAqua)
        
        // Configurar ventana principal
        if let window = NSApp.windows.first {
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.styleMask.insert(.fullSizeContentView)
            window.isMovableByWindowBackground = true
            window.center()
        }
    }
    
    // La app sigue ejecutándose al cerrar ventana principal
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            for window in sender.windows {
                window.makeKeyAndOrderFront(nil)
            }
        }
        return true
    }
}
