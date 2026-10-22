# frozen_string_literal: true
require "fileutils"

module Jekyll
  module ImageConverter
    def self.convert_images(source_dir)
      convert_cmd = find_convert_command
      unless convert_cmd
        Jekyll.logger.warn "ImageConverter:", "ImageMagick ('magick' or 'convert') not detected in PATH. Skipping auto-conversion."
        return
      end

      assets_dirs = [
        File.join(source_dir, "assets"),
        File.join(source_dir, "assets", "images")
      ].select { |d| Dir.exist?(d) }

      converted_count = 0
      thumb_count = 0

      # 1. Process JPG/JPEG/PNG files
      all_source_files = []
      assets_dirs.each do |dir|
        all_source_files.concat(Dir.glob(File.join(dir, "**", "*.{jpg,jpeg,png,JPG,JPEG,PNG}")))
      end

      all_source_files.uniq.each do |src_path|
        next if src_path.include?("/logos/") || src_path.include?("\\logos\\") # Avoid altering logos
        
        ext = File.extname(src_path)
        base_without_ext = src_path[0..(-ext.length - 1)]
        is_already_thumb = base_without_ext.end_with?("-thumb")
        webp_path = "#{base_without_ext}.webp"
        thumb_path = is_already_thumb ? webp_path : "#{base_without_ext}-thumb.webp"

        # Convert source to WebP if missing or source is newer
        if !File.exist?(webp_path) || File.mtime(src_path) > File.mtime(webp_path)
          cmd = "#{convert_cmd} \"#{src_path}\" -quality 85 \"#{webp_path}\""
          if system(cmd)
            converted_count += 1
            Jekyll.logger.info "ImageConverter:", "Converted #{File.basename(src_path)} -> #{File.basename(webp_path)}"
          end
        end

        # Create thumbnail version if not already a thumbnail file
        unless is_already_thumb
          if !File.exist?(thumb_path) || File.mtime(src_path) > File.mtime(thumb_path)
            cmd = "#{convert_cmd} \"#{src_path}\" -resize \"800x600>\" -quality 82 \"#{thumb_path}\""
            if system(cmd)
              thumb_count += 1
              Jekyll.logger.info "ImageConverter:", "Generated thumbnail #{File.basename(thumb_path)}"
            end
          end
        end
      end

      # 2. Process WebP files (create thumbnail if not already a thumbnail)
      all_webp_files = []
      assets_dirs.each do |dir|
        all_webp_files.concat(Dir.glob(File.join(dir, "**", "*.webp")))
      end

      all_webp_files.uniq.each do |webp_path|
        next if webp_path.include?("/logos/") || webp_path.include?("\\logos\\")
        next if webp_path.end_with?("-thumb.webp")
        ext = File.extname(webp_path)
        base_without_ext = webp_path[0..(-ext.length - 1)]
        thumb_path = "#{base_without_ext}-thumb.webp"

        if !File.exist?(thumb_path) || File.mtime(webp_path) > File.mtime(thumb_path)
          cmd = "#{convert_cmd} \"#{webp_path}\" -resize \"800x600>\" -quality 82 \"#{thumb_path}\""
          if system(cmd)
            thumb_count += 1
            Jekyll.logger.info "ImageConverter:", "Generated thumbnail #{File.basename(thumb_path)}"
          end
        end
      end

      if converted_count > 0 || thumb_count > 0
        Jekyll.logger.info "ImageConverter:", "Image optimization complete (converted: #{converted_count}, thumbnails: #{thumb_count})."
      end
    end

    def self.find_convert_command
      is_windows = Gem.win_platform? || (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM)
      null_target = is_windows ? "NUL" : "/dev/null"

      # 1. Test modern ImageMagick 7+ 'magick' binary (primary command on Windows & modern OS)
      if system("magick -version > #{null_target} 2>&1")
        return "magick"
      end

      # 2. Test legacy 'convert' binary (ensure it's ImageMagick, not Windows System32 convert.exe)
      if !is_windows
        if system("convert -version > #{null_target} 2>&1")
          return "convert"
        end
      else
        begin
          out = `convert -version 2>&1`
          return "convert" if out.downcase.include?("imagemagick")
        rescue StandardError
          # Ignore error
        end
      end

      nil
    end
  end
end

Jekyll::Hooks.register :site, :after_reset do |site|
  Jekyll::ImageConverter.convert_images(site.source)
end
