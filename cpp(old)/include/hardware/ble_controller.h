#pragma once

#include <QObject>
#include <QString>
#include <QVariantHash>
#include <QTimer>
#include <QBluetoothDeviceDiscoveryAgent>
#include <QBluetoothDeviceInfo>
#include <QLowEnergyController>
#include <QLowEnergyService>
#include <QLowEnergyCharacteristic>
#include <QJsonDocument>
#include <QJsonObject>
#include <functional>
#include <memory>

class BLEController : public QObject {
    Q_OBJECT

public:
    enum class ConnectionState {
        Disconnected,
        Connecting,
        Connected
    };

    explicit BLEController(QObject* parent = nullptr);
    ~BLEController() override;
    
    void setLogCallback(std::function<void(const QString&, const QString&)> callback);
    bool isConnected() const { return connectionState == ConnectionState::Connected; }
    ConnectionState getConnectionState() const { return connectionState; }
    
    void scanForHub();
    void connectToDevice(const QBluetoothDeviceInfo &deviceInfo);
    void connectToHub();
    void disconnectFromHub();
    void sendCommand(const QVariantHash& command);

signals:
    void connectionStateChanged(ConnectionState state);
    void hubFound(const QString& hubName);
    void commandSent(const QVariantHash& command);
    void errorOccurred(const QString& error);

private slots:
    void onDeviceDiscovered(const QBluetoothDeviceInfo& device);
    void onDiscoveryFinished();
    void onDiscoveryError(QBluetoothDeviceDiscoveryAgent::Error error);
    void onControllerConnected();
    void onControllerDisconnected();
    void onControllerError(QLowEnergyController::Error error);
    void onServiceDiscovered(const QBluetoothUuid& serviceUuid);
    void onServiceDiscoveryFinished();
    void onServiceStateChanged(QLowEnergyService::ServiceState state);
    void onCharacteristicRead(const QLowEnergyCharacteristic& characteristic, const QByteArray& value);
    void onCharacteristicWritten(const QLowEnergyCharacteristic& characteristic, const QByteArray& value);
    void onCharacteristicChanged(const QLowEnergyCharacteristic& characteristic, const QByteArray& value);
    void onDescriptorWritten(const QLowEnergyDescriptor& descriptor, const QByteArray& value);

private:
    void logMessage(const QString& message, const QString& level = "info");
    void connectToService();
    void handleResponse(const QByteArray& data);
    
    std::function<void(const QString&, const QString&)> logCallback;
    std::unique_ptr<QBluetoothDeviceDiscoveryAgent> discoveryAgent;
    std::unique_ptr<QLowEnergyController> controller;
    std::unique_ptr<QLowEnergyService> service;
    
    QBluetoothDeviceInfo targetDevice;
    QLowEnergyCharacteristic commandCharacteristic;
    
    ConnectionState connectionState = ConnectionState::Disconnected;
    bool scanning = false;
    
    static constexpr const char* HUB_NAME_PREFIX = "Pybricks";
    static constexpr const char* PYBRICKS_COMMAND_CHARACTERISTIC_UUID = "c5f50002-8280-46da-89f4-6d8051e4aeef";
}; 