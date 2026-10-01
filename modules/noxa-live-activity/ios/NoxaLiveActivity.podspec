Pod::Spec.new do |s|
  s.name           = 'NoxaLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'NOXA Drive Together ActivityKit bridge'
  s.description    = 'A small Expo Module bridge for starting, updating, and ending NOXA Drive Together Live Activities.'
  s.author         = 'NOXA'
  s.homepage       = 'https://noxastreetapp.com'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.swift_version = '5.9'
end
