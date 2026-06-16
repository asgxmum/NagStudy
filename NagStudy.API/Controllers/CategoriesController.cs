using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")] // for /api/categories
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly NagStudyContext _db;

    public CategoriesController(NagStudyContext db)
    {
        _db = db;
    }

    //Retrieve my user ID from the token (the value stored by TokenService in the Sub)
    private int CurrentUserId => User.GetUserId();

    //GET /api/categories (entire categories)
    [HttpGet]
    public async Task<IActionResult> GetALL()
    {
        var items = await _db.Categories
                    .Where(c => c.UserId == CurrentUserId) // Only for user
                    .OrderBy(c => c.Name)
                    .ToListAsync();
        return Ok(items);
    }

    //GET /api/categories/5 - for one category
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(int id)
    {
        var item = await _db.Categories
                  .FirstOrDefaultAsync(c => c.Id == id && c.UserId == CurrentUserId);
        if (item == null)
            return NotFound();
        return Ok(item);
    }

    //POST /api/categories - create a new category
    [HttpPost]
    public async Task<IActionResult> Create(CategoryRequest request)
    {
        var dup = await _db.Categories
                 .AnyAsync(c => c.UserId == CurrentUserId && c.Name == request.Name);
        if (dup) return BadRequest(new { message = "You already have a category with this name." });

        var category = new Category
        {
            UserId = CurrentUserId,
            Name = request.Name,
            Color = request.Color,
            CreatedAt = DateTime.UtcNow
        };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetOne), new { id = category.Id }, category);
    }

    //PUT / api/categories/5 - Revise Categories
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, CategoryRequest request)
    {
        var category = await _db.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == CurrentUserId);
        if (category == null) return NotFound();

        category.Name = request.Name;
        category.Color = request.Color;
        await _db.SaveChangesAsync();
        return Ok(category);
    }

    //DELETE /api/categories/5 -delete a category
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _db.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == CurrentUserId);
        if (category == null) return NotFound();

        // Do not delete if a session is connected 
        var hasSessions = await _db.StudySessions.AnyAsync(s => s.CategoryId == id);
        if (hasSessions)
            return BadRequest(new { message = "This category has study sessions and cannot be deleted." });

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();
        return NoContent();

    }

}