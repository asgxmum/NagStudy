using System.ComponentModel.DataAnnotations;

namespace NagStudy.API.Models.DTO;

public class CategoryRequest
{
    [Required, MaxLength(30)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", ErrorMessage = "Color must be a hex code like #E8734A.")]
    public string Color { get; set; } = string.Empty; //hex, e.g. #E8734A

}