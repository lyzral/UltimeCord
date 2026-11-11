using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using EndcordInstaller.Core;

namespace EndcordInstaller.UI
{
    /// <summary>Asks for an Ultime Cord license key before the installer opens.</summary>
    public sealed class LicenseWindow : Window
    {
        readonly TextBox _input;
        readonly TextBlock _error;
        readonly Button _ok;

        static SolidColorBrush Brush(byte r, byte g, byte b, byte a = 255)
        {
            var br = new SolidColorBrush(Color.FromArgb(a, r, g, b));
            br.Freeze();
            return br;
        }

        public LicenseWindow()
        {
            Title = "Ultime Cord — Licence";
            Width = 480;
            SizeToContent = SizeToContent.Height;
            ResizeMode = ResizeMode.NoResize;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            Background = Brush(10, 10, 10);
            FontFamily = new FontFamily("Segoe UI");

            var root = new StackPanel { Margin = new Thickness(28, 26, 28, 24) };

            root.Children.Add(new TextBlock { Text = "ULTIME CORD", FontSize = 11, FontWeight = FontWeights.Bold, Foreground = Brush(255, 255, 255, 115), Margin = new Thickness(0, 0, 0, 6) });
            root.Children.Add(new TextBlock { Text = "Clé de licence", FontSize = 24, FontWeight = FontWeights.Bold, Foreground = Brushes.White });
            root.Children.Add(new TextBlock
            {
                Text = "Ultime Cord a besoin d'une clé faite pour ce PC. Envoie ton code PC à Sei, puis colle la clé qu'il te donne.",
                FontSize = 13, Foreground = Brush(255, 255, 255, 180), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 8, 0, 14)
            });

            // this PC's code, to send to Sei
            var hwRow = new DockPanel { Margin = new Thickness(0, 0, 0, 14) };
            var hwBox = new Border
            {
                Background = Brush(255, 255, 255, 10), BorderBrush = Brush(255, 255, 255, 25), BorderThickness = new Thickness(1),
                Padding = new Thickness(12, 9, 12, 9), CornerRadius = new CornerRadius(8)
            };
            var hwInner = new DockPanel();
            var copyBtn = new Button
            {
                Content = "copier", Padding = new Thickness(12, 4, 12, 4), Background = Brush(255, 255, 255, 18), Foreground = Brushes.White,
                BorderThickness = new Thickness(0), Cursor = Cursors.Hand, VerticalAlignment = VerticalAlignment.Center
            };
            string code = License.Hwid;
            copyBtn.Click += (s, e) => { try { Clipboard.SetText(code); copyBtn.Content = "copié"; } catch { } };
            DockPanel.SetDock(copyBtn, Dock.Right);
            hwInner.Children.Add(copyBtn);
            var hwText = new StackPanel();
            hwText.Children.Add(new TextBlock { Text = "CODE PC", FontSize = 10.5, FontWeight = FontWeights.Bold, Foreground = Brush(255, 255, 255, 120) });
            hwText.Children.Add(new TextBlock { Text = code.Length > 0 ? code : "introuvable", FontFamily = new FontFamily("Consolas"), FontSize = 16, Foreground = Brushes.White });
            hwInner.Children.Add(hwText);
            hwBox.Child = hwInner;
            hwRow.Children.Add(hwBox);
            root.Children.Add(hwRow);

            _input = new TextBox
            {
                FontFamily = new FontFamily("Consolas"), FontSize = 13, Padding = new Thickness(10, 9, 10, 9),
                Background = Brush(255, 255, 255, 12), Foreground = Brushes.White, CaretBrush = Brushes.White,
                BorderBrush = Brush(255, 255, 255, 30), BorderThickness = new Thickness(1)
            };
            _input.TextChanged += (s, e) => { _ok.IsEnabled = _input.Text.Trim().Length > 0; _error.Visibility = Visibility.Collapsed; };
            _input.KeyDown += (s, e) => { if (e.Key == Key.Enter && _ok.IsEnabled) Submit(); };
            root.Children.Add(_input);

            _error = new TextBlock { FontSize = 13, Foreground = Brush(255, 138, 138), Margin = new Thickness(0, 10, 0, 0), Visibility = Visibility.Collapsed, TextWrapping = TextWrapping.Wrap };
            root.Children.Add(_error);

            _ok = new Button
            {
                Content = "Activer", IsEnabled = false, Margin = new Thickness(0, 16, 0, 0), Padding = new Thickness(0, 10, 0, 10),
                FontSize = 14, FontWeight = FontWeights.SemiBold, Background = Brush(217, 217, 221), Foreground = Brushes.Black,
                BorderThickness = new Thickness(0), Cursor = Cursors.Hand
            };
            _ok.Click += (s, e) => Submit();
            root.Children.Add(_ok);

            root.Children.Add(new TextBlock
            {
                Text = "Pas de clé ? Demande à Sei · github.com/lyzral", FontSize = 11.5, Foreground = Brush(255, 255, 255, 100),
                HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 14, 0, 0)
            });

            Content = root;
            Loaded += (s, e) => _input.Focus();
        }

        void Submit()
        {
            var r = License.Check(_input.Text);
            if (!r.Ok)
            {
                _error.Text = r.Error;
                _error.Visibility = Visibility.Visible;
                return;
            }
            License.Save(_input.Text);
            DialogResult = true;
            Close();
        }
    }
}
